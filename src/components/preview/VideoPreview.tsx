import { useRef, useEffect, useCallback, useState } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";
import { TextOverlay } from "./TextOverlay";
import type { VideoPreviewProps } from "@/types";
import type { VideoClip } from "@/schemas";

export function VideoPreview({
  currentTime,
  isPlaying,
  onTimeUpdate,
  className,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  const { clips, resolution } = useTimelineStore();

  // Find the active video clip at current time
  const activeVideoClip = Array.from(clips.values()).find(
    (clip): clip is VideoClip =>
      clip.type === "video" &&
      currentTime >= clip.startTime &&
      currentTime < clip.startTime + clip.duration
  );

  // Calculate video time from timeline time
  const getVideoTime = useCallback(
    (clip: VideoClip | undefined, timelineTime: number): number => {
      if (!clip) return 0;
      return clip.sourceStartTime + (timelineTime - clip.startTime);
    },
    []
  );

  // Handle video source change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (activeVideoClip) {
      if (video.src !== activeVideoClip.sourceUrl) {
        setIsLoaded(false);
        setError(null);
        video.src = activeVideoClip.sourceUrl;
        video.load();
      }
    } else {
      video.src = "";
      setIsLoaded(false);
    }
  }, [activeVideoClip?.sourceUrl]);

  // Sync video time with timeline
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip || !isLoaded) return;

    const videoTime = getVideoTime(activeVideoClip, currentTime);
    const timeDiff = Math.abs(video.currentTime - videoTime);

    // Only seek if:
    // 1. Not playing and difference is notable (> 0.05s) - for scrubbing
    // 2. Playing but difference is large (> 0.5s) - for initial sync or clip changes
    // This prevents micro-seeks during playback that cause stuttering
    if ((!isPlaying && timeDiff > 0.05) || (isPlaying && timeDiff > 0.5)) {
      video.currentTime = videoTime;
      lastSeekTimeRef.current = videoTime;
    }
  }, [currentTime, activeVideoClip, isLoaded, getVideoTime, isPlaying]);

  // Handle play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;

    if (isPlaying && activeVideoClip) {
      video.play().catch(() => {
        // Ignore autoplay errors
      });
    } else {
      video.pause();
    }
  }, [isPlaying, activeVideoClip, isLoaded]);

  // Handle volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip) return;

    video.volume = activeVideoClip.muted ? 0 : activeVideoClip.volume;
  }, [activeVideoClip?.volume, activeVideoClip?.muted]);

  // Handle video events
  const handleLoadedData = useCallback(() => {
    setIsLoaded(true);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setError("Failed to load video");
    setIsLoaded(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip || !isPlaying) return;

    // Calculate timeline time from video time
    const timelineTime =
      activeVideoClip.startTime + (video.currentTime - activeVideoClip.sourceStartTime);
    onTimeUpdate(timelineTime);
  }, [activeVideoClip, isPlaying, onTimeUpdate]);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg bg-black",
        className
      )}
      style={{
        aspectRatio: `${resolution.width} / ${resolution.height}`,
        maxHeight: "100%",
        maxWidth: "100%",
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className={cn(
          "h-full w-full object-contain",
          !activeVideoClip && "hidden"
        )}
        playsInline
        muted={activeVideoClip?.muted}
        onLoadedData={handleLoadedData}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Text overlays */}
      <TextOverlay currentTime={currentTime} />

      {/* Loading state */}
      {activeVideoClip && !isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-red-400">
            <div className="mb-2 text-2xl">!</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* No video state */}
      {!activeVideoClip && (
        <div className="flex flex-col items-center justify-center text-zinc-500">
          <svg
            className="mb-2 h-12 w-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
          </svg>
          <span className="text-sm">No video at current time</span>
        </div>
      )}

      {/* Playback indicator overlay */}
      {isPlaying && activeVideoClip && isLoaded && (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs text-white">
          <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Playing
        </div>
      )}
    </div>
  );
}
