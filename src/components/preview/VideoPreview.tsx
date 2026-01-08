import { useRef, useEffect, useCallback, useState, useMemo, memo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";
import { TextOverlay } from "./TextOverlay";
import type { VideoPreviewProps } from "@/types";
import type { VideoClip, AudioClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";
import { RotateCw } from "lucide-react";

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

  // Get animated properties for keyframe animations
  const animated = useMemo(
    () => getAnimatedPropertiesAtTime(clip, currentTime),
    [clip, currentTime]
  );

  return (
    <video
      ref={videoRef}
      src={clip.sourceUrl}
      className="absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200"
      style={{
        opacity: isInRange ? animated.opacity : 0,
        transform: isInRange
          ? `scale(${animated.scale}) rotate(${animated.rotation}deg)`
          : undefined,
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

  // Get animated volume
  const animated = useMemo(
    () => getAnimatedPropertiesAtTime(clip, currentTime),
    [clip, currentTime]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 1. Mute/Volume - use animated volume if available
    audio.muted = !isActive || clip.muted || trackMuted;
    audio.volume = animated.volume ?? clip.volume;
    
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
  }, [isActive, isPlaying, clip, currentTime, trackMuted, animated]);

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
  const selectClip = useTimelineStore((state) => state.selectClip);
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);

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
  const playerRef = useRef<HTMLDivElement>(null);
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
      {/* Wrapper for player + overlay - positioned relative so overlay can extend beyond player */}
      <div className="relative" style={playerStyle}>
        {/* Player container - has overflow:hidden for video content only */}
        <div
          ref={playerRef}
          className="relative w-full h-full overflow-hidden rounded-lg bg-black shadow-2xl cursor-pointer"
          onClick={(e) => {
            // Only select if clicking directly on container (not on text overlay)
            if (e.target === e.currentTarget && activeVideoClip) {
              selectClip(activeVideoClip.id, e.shiftKey);
            }
          }}
        >
          {/* Render all video clips - layered by track order (top track = higher z-index) */}
          {videoClips.map((clip, index) => {
            const isActive = activeVideoClip?.id === clip.id;
            return (
              <div
                key={clip.id}
                className="absolute inset-0 cursor-pointer"
                style={{ zIndex: videoClips.length - index }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isActive) {
                    selectClip(clip.id, e.shiftKey);
                  }
                }}
              >
                <VideoLayer
                  clip={clip}
                  isActive={isActive}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  onTimeUpdate={onTimeUpdate}
                  onLoadStatusChange={handleLoadStatusChange}
                  trackMuted={tracks.get(clip.trackId)?.muted ?? false}
                  zIndex={1}
                />
              </div>
            );
          })}

          {/* Video selection overlay with transform handles - rendered with high z-index */}
          {activeVideoClip && selectedClipIds.includes(activeVideoClip.id) && (
            <div className="absolute inset-0 pointer-events-none border-2 border-cyan-400 rounded-lg z-10">
              {/* Corner handles for scaling */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full pointer-events-auto cursor-nwse-resize hover:bg-cyan-100" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full pointer-events-auto cursor-nesw-resize hover:bg-cyan-100" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full pointer-events-auto cursor-nesw-resize hover:bg-cyan-100" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full pointer-events-auto cursor-nwse-resize hover:bg-cyan-100" />
              
              {/* Rotation handle - positioned above the element */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                <div className="w-5 h-5 bg-white border-2 border-cyan-400 rounded-full cursor-grab hover:bg-cyan-100 flex items-center justify-center">
                  <RotateCw className="w-3 h-3 text-cyan-600" />
                </div>
                {/* Connecting line */}
                <div className="w-0.5 h-4 bg-cyan-400" />
              </div>
            </div>
          )}

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

        {/* Text overlays - OUTSIDE player's overflow:hidden, but positioned relative to it */}
        <TextOverlay currentTime={currentTime} containerRef={playerRef} />
      </div>
    </div>
  );
}
