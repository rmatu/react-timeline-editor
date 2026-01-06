import { useCallback, useRef, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";

interface UsePlayheadOptions {
  onTimeUpdate?: (time: number) => void;
}

export function usePlayhead(options: UsePlayheadOptions = {}) {
  const { onTimeUpdate } = options;
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const {
    currentTime,
    isPlaying,
    playbackRate,
    totalDuration,
    loop,
    loopStart,
    loopEnd,
    setCurrentTime,
    play,
    pause,
    togglePlayback,
  } = useTimelineStore();

  // Animation loop for playback
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (timestamp: number) => {
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      let newTime = currentTime + delta * playbackRate;

      // Handle looping
      if (loop && loopStart !== null && loopEnd !== null) {
        if (newTime >= loopEnd) {
          newTime = loopStart + (newTime - loopEnd);
        }
      } else {
        // Handle end of timeline
        if (newTime >= totalDuration) {
          newTime = 0;
          // Optionally pause at end instead of looping
          // pause();
        }
      }

      setCurrentTime(newTime);
      onTimeUpdate?.(newTime);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isPlaying,
    currentTime,
    playbackRate,
    totalDuration,
    loop,
    loopStart,
    loopEnd,
    setCurrentTime,
    onTimeUpdate,
  ]);

  // Seek to a specific time
  const seekTo = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, Math.min(totalDuration, time));
      setCurrentTime(clampedTime);
      onTimeUpdate?.(clampedTime);
    },
    [totalDuration, setCurrentTime, onTimeUpdate]
  );

  // Seek by a relative amount
  const seekBy = useCallback(
    (delta: number) => {
      seekTo(currentTime + delta);
    },
    [currentTime, seekTo]
  );

  // Jump to start
  const jumpToStart = useCallback(() => {
    seekTo(0);
  }, [seekTo]);

  // Jump to end
  const jumpToEnd = useCallback(() => {
    seekTo(totalDuration);
  }, [seekTo, totalDuration]);

  // Step forward one frame
  const stepForward = useCallback(
    (fps: number = 30) => {
      seekBy(1 / fps);
    },
    [seekBy]
  );

  // Step backward one frame
  const stepBackward = useCallback(
    (fps: number = 30) => {
      seekBy(-1 / fps);
    },
    [seekBy]
  );

  return {
    currentTime,
    isPlaying,
    playbackRate,
    play,
    pause,
    togglePlayback,
    seekTo,
    seekBy,
    jumpToStart,
    jumpToEnd,
    stepForward,
    stepBackward,
  };
}
