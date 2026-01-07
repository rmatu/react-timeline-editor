import { useRef, useEffect, useCallback, useState, useMemo, memo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";
import { TextOverlay } from "./TextOverlay";
import type { VideoPreviewProps } from "@/types";
import type { VideoClip, AudioClip } from "@/schemas";

// Separate component for each video layer to manage its own ref and state
const VideoLayer = memo(({ 
  clip, 
  isActive, 
  isPlaying, 
  currentTime, 
  onTimeUpdate,
  onLoadStatusChange,
  trackMuted,
  zIndex = 1,
}: { 
  clip: VideoClip, 
  isActive: boolean, 
  isPlaying: boolean, 
  currentTime: number,
  onTimeUpdate: (time: number) => void,
  onLoadStatusChange: (id: string, isLoaded: boolean) => void,
  trackMuted: boolean,
  zIndex?: number,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync loaded state to parent
  useEffect(() => {
    onLoadStatusChange(clip.id, isLoaded);
  }, [clip.id, isLoaded, onLoadStatusChange]);

  // Handle video logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 1. Mute/Volume - Always mute video element, audio is handled by AudioLayer
    video.muted = true;
    video.playbackRate = clip.playbackRate;

    // 2. Playback State
    if (isActive && isPlaying) {
      video.play().catch(() => {
        // Autoplay restrictions or not loaded yet
      });
    } else {
      video.pause();
    }

    // 3. Time Sync
    const targetVideoTime = clip.sourceStartTime + (currentTime - clip.startTime) * clip.playbackRate;
    
    // Check if we need to sync (seek)
    const timeDiff = Math.abs(video.currentTime - targetVideoTime);
    
    if (!isPlaying || timeDiff > 0.2) {
      // Check for finite numbers to avoid errors
      if (Number.isFinite(targetVideoTime)) {
         video.currentTime = targetVideoTime;
      }
    }
  }, [isActive, isPlaying, clip, currentTime, trackMuted]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!isActive || !isPlaying) return;
    const video = e.currentTarget;
    const timelineTime = clip.startTime + (video.currentTime - clip.sourceStartTime);
    onTimeUpdate(timelineTime);
  };

  const handleLoadedData = () => {
    setIsLoaded(true);
  };

  // Check if clip is in range (should be visible even if not active)
  const isInRange = currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration;

  return (
    <video
      ref={videoRef}
      src={clip.sourceUrl}
      className="absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200"
      style={{
        opacity: isInRange ? 1 : 0,
        zIndex: isInRange ? zIndex : 0,
      }}
      preload="auto"
      playsInline
      onLoadedData={handleLoadedData}
      onTimeUpdate={handleTimeUpdate}
    />
  );
});

VideoLayer.displayName = "VideoLayer";

const AudioLayer = memo(({ 
  clip, 
  isActive, 
  isPlaying, 
  currentTime, 
  trackMuted,
}: { 
  clip: AudioClip | VideoClip, 
  isActive: boolean, 
  isPlaying: boolean, 
  currentTime: number,
  trackMuted: boolean
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 1. Mute/Volume
    audio.muted = !isActive || clip.muted || trackMuted;
    audio.volume = clip.volume;
    
    // Handle playbackRate for video clips
    const playbackRate = clip.type === 'video' ? clip.playbackRate : 1;
    audio.playbackRate = playbackRate;

    // 2. Playback State
    if (isActive && isPlaying) {
      audio.play().catch(() => {
        // Autoplay restrictions
      });
    } else {
      audio.pause();
    }

    // 3. Time Sync - account for playbackRate on video clips
    const targetAudioTime = clip.sourceStartTime + (currentTime - clip.startTime) * playbackRate;
    
    const timeDiff = Math.abs(audio.currentTime - targetAudioTime);
    
    if (!isPlaying || timeDiff > 0.2) {
      if (Number.isFinite(targetAudioTime)) {
         audio.currentTime = targetAudioTime;
      }
    }
  }, [isActive, isPlaying, clip, currentTime, trackMuted]);

  return (
    <audio
      ref={audioRef}
      src={clip.sourceUrl}
      className="hidden"
      preload="auto"
      onEnded={() => { /* Loop or stop? defaults to stop */ }}
    />
  );
});

AudioLayer.displayName = "AudioLayer";

export function VideoPreview({
  currentTime,
  isPlaying,
  onTimeUpdate,
  className,
}: VideoPreviewProps) {
  // Select specific parts of store to avoid unnecessary re-renders
  const clips = useTimelineStore((state) => state.clips);
  const tracks = useTimelineStore((state) => state.tracks);
  const resolution = useTimelineStore((state) => state.resolution);

  const [loadedStates, setLoadedStates] = useState<Record<string, boolean>>({});

  // Get all video clips sorted by track order (top track = lower order = higher priority)
  const videoClips = useMemo(() => {
    const videos = Array.from(clips.values()).filter((c): c is VideoClip => c.type === "video");
    // Sort by track order (ascending) so top tracks come first
    return videos.sort((a, b) => {
      const trackA = tracks.get(a.trackId);
      const trackB = tracks.get(b.trackId);
      return (trackA?.order ?? 999) - (trackB?.order ?? 999);
    });
  }, [clips, tracks]);

  // Find the active video clip at current time (top track wins)
  const activeVideoClip = useMemo(() => 
    videoClips.find(
      (clip) =>
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration &&
        tracks.get(clip.trackId)?.visible !== false
    ),
    [videoClips, currentTime, tracks]
  );

  const handleLoadStatusChange = useCallback((id: string, isLoaded: boolean) => {
    setLoadedStates((prev) => ({ ...prev, [id]: isLoaded }));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate optimal player dimensions to contain within parent while maintaining aspect ratio
  const playerStyle = useMemo(() => {
    if (containerDimensions.width === 0 || containerDimensions.height === 0) {
      return { width: "100%", height: "100%" }; // Fallback
    }

    const { width: containerW, height: containerH } = containerDimensions;
    const targetAspect = resolution.width / resolution.height;
    const containerAspect = containerW / containerH;

    let width, height;

    if (containerAspect > targetAspect) {
      // Container is wider than target -> Constrain by height
      height = containerH;
      width = height * targetAspect;
    } else {
      // Container is taller than target -> Constrain by width
      width = containerW;
      height = width / targetAspect;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [containerDimensions, resolution]);

  return (
    <div ref={containerRef} className={cn("flex items-center justify-center w-full h-full min-h-0", className)}>
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl"
        style={playerStyle}
      >
        {/* Render all video clips - layered by track order (top track = higher z-index) */}
        {videoClips.map((clip, index) => (
          <VideoLayer
            key={clip.id}
            clip={clip}
            isActive={activeVideoClip?.id === clip.id}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onTimeUpdate={onTimeUpdate}
            onLoadStatusChange={handleLoadStatusChange}
            trackMuted={tracks.get(clip.trackId)?.muted ?? false}
            zIndex={videoClips.length - index} // Top track (first in array) gets highest z-index
          />
        ))}

        {/* Render all audio clips AND video clip audio */}
        {Array.from(clips.values())
          .filter((c): c is AudioClip | VideoClip => c.type === "audio" || c.type === "video")
          .map((clip) => {
             const track = tracks.get(clip.trackId);
             const isActive = currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration && track?.visible !== false;
             return (
              <AudioLayer
                key={`audio-${clip.id}`}
                clip={clip}
                isActive={isActive}
                isPlaying={isPlaying}
                currentTime={currentTime}
                trackMuted={track?.muted ?? false}
              />
            );
          })}


        {/* Text overlays */}
        <TextOverlay currentTime={currentTime} />

        {/* Loading state - only if active clip is not loaded */}
        {activeVideoClip && !loadedStates[activeVideoClip.id] && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}

        {/* Playback indicator overlay */}
        {isPlaying && activeVideoClip && (
          <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs text-white z-20">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Playing
          </div>
        )}
      </div>
    </div>
  );
}
