import { useRef, useEffect, useCallback, useState, useMemo, memo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";
import { TextOverlay } from "./TextOverlay";
import type { VideoPreviewProps } from "@/types";
import type { VideoClip } from "@/schemas";

// Separate component for each video layer to manage its own ref and state
const VideoLayer = memo(({ 
  clip, 
  isActive, 
  isPlaying, 
  currentTime, 
  onTimeUpdate,
  onLoadStatusChange
}: { 
  clip: VideoClip, 
  isActive: boolean, 
  isPlaying: boolean, 
  currentTime: number,
  onTimeUpdate: (time: number) => void,
  onLoadStatusChange: (id: string, isLoaded: boolean) => void
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

    // 1. Mute/Volume
    video.muted = !isActive || clip.muted;
    video.volume = clip.volume;

    // 2. Playback State
    // If active and global Playing is true, play. Otherwise pause.
    if (isActive && isPlaying) {
      video.play().catch(() => {
        // Autoplay restrictions or not loaded yet
      });
    } else {
      video.pause();
    }

    // 3. Time Sync
    const targetVideoTime = clip.sourceStartTime + (currentTime - clip.startTime);
    
    // Check if we need to sync (seek)
    // We strictly sync if:
    // a) We are paused (scrubbing)
    // b) We are playing but drifted significantly (> 0.2s)
    const timeDiff = Math.abs(video.currentTime - targetVideoTime);
    
    if (!isPlaying || timeDiff > 0.2) {
      // Check for finite numbers to avoid errors
      if (Number.isFinite(targetVideoTime)) {
         video.currentTime = targetVideoTime;
      }
    }
  }, [isActive, isPlaying, clip, currentTime]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!isActive || !isPlaying) return;
    const video = e.currentTarget;
    const timelineTime = clip.startTime + (video.currentTime - clip.sourceStartTime);
    onTimeUpdate(timelineTime);
  };

  const handleLoadedData = () => {
    setIsLoaded(true);
  };

  return (
    <video
      ref={videoRef}
      src={clip.sourceUrl}
      className={cn(
        "absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200",
        isActive ? "opacity-100 z-10" : "opacity-0 z-0"
      )}
      playsInline
      onLoadedData={handleLoadedData}
      onTimeUpdate={handleTimeUpdate}
    />
  );
});

VideoLayer.displayName = "VideoLayer";

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

  // Get all video clips (memoized)
  const videoClips = useMemo(() => 
    Array.from(clips.values()).filter((c): c is VideoClip => c.type === "video"),
    [clips]
  );

  // Find the active video clip at current time
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
        {/* Render all video clips */}
        {videoClips.map((clip) => (
          <VideoLayer
            key={clip.id}
            clip={clip}
            isActive={activeVideoClip?.id === clip.id}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onTimeUpdate={onTimeUpdate}
            onLoadStatusChange={handleLoadStatusChange}
          />
        ))}

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
