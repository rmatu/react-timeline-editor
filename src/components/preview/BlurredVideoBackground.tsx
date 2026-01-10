import { useEffect, useRef } from "react";
import type { VideoClip } from "@/schemas";

interface BlurredVideoBackgroundProps {
  clip: VideoClip;
  currentTime: number;
  isPlaying: boolean;
  blurAmount: number;
}

export function BlurredVideoBackground({
  clip,
  currentTime,
  isPlaying,
  blurAmount,
}: BlurredVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Calculate target time in source video
    // (currentTime - clip.startTime) is time elapsed into the clip
    // Multiply by playbackRate to get time elapsed in source
    const timeInClip = (currentTime - clip.startTime) * clip.playbackRate;
    const targetTime = Math.max(0, clip.sourceStartTime + timeInClip);
    
    const timeDiff = Math.abs(el.currentTime - targetTime);

    // Sync if drifted too far or if just seeking (not playing)
    // When playing, we let the video play naturally and only correct if drift is large
    if (!isPlaying || timeDiff > 0.3) {
      if (Number.isFinite(targetTime)) {
        el.currentTime = targetTime;
      }
    }

    el.playbackRate = clip.playbackRate || 1;

    if (isPlaying && el.paused) {
      el.play().catch(() => {});
    } else if (!isPlaying && !el.paused) {
      el.pause();
    }
  }, [currentTime, isPlaying, clip.startTime, clip.sourceStartTime, clip.playbackRate]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
      <video
        ref={videoRef}
        src={clip.sourceUrl}
        className="w-full h-full object-cover scale-110 opacity-50"
        style={{
          filter: `blur(${Math.max(0, blurAmount) * 0.5}px)`
        }}
        muted
        playsInline
      />
    </div>
  );
}
