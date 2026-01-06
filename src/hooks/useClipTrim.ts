import { useState, useRef } from "react";
import { useDrag } from "@use-gesture/react";
import { useAtom } from "jotai";
import { useTimelineStore } from "@/stores/timelineStore";
import { snapGuideAtom, showSnapGuide, hideSnapGuide } from "@/components/timeline/SnapGuide";
import {
  generateSnapPoints,
  snapTrimPosition,
  calculateSnapThreshold,
} from "@/utils/snapping";
import { pixelsToTime, timeToPixels } from "@/utils/time";
import { hasFiniteDuration } from "@/schemas";
import {
  SNAP_THRESHOLD_PX,
  MIN_CLIP_DURATION,
} from "@/constants/timeline.constants";
import type { Clip } from "@/schemas";

interface UseClipTrimOptions {
  clip: Clip;
  zoomLevel: number;
  disabled?: boolean;
}

export function useClipTrim({ clip, zoomLevel, disabled = false }: UseClipTrimOptions) {
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimSide, setTrimSide] = useState<"left" | "right" | null>(null);
  const [, setSnapGuide] = useAtom(snapGuideAtom);

  const initialStateRef = useRef({
    startTime: clip.startTime,
    duration: clip.duration,
    sourceStartTime: clip.sourceStartTime,
  });

  const {
    clips,
    currentTime,
    totalDuration,
    trimClip,
    setTrimming,
    saveToHistory,
  } = useTimelineStore();

  // Calculate if the clip can extend in each direction
  const canExtendLeft =
    hasFiniteDuration(clip) && clip.sourceStartTime > 0;
  const canExtendRight =
    hasFiniteDuration(clip) &&
    clip.maxDuration !== undefined &&
    clip.sourceStartTime + clip.duration < clip.maxDuration;

  // Left trim handle
  const bindLeft = useDrag(
    ({ movement: [mx], first, last, cancel, memo }) => {
      if (disabled) {
        cancel();
        return;
      }

      if (first) {
        initialStateRef.current = {
          startTime: clip.startTime,
          duration: clip.duration,
          sourceStartTime: clip.sourceStartTime,
        };
        setIsTrimming(true);
        setTrimSide("left");
        setTrimming(true, clip.id);
        saveToHistory();
        return initialStateRef.current;
      }

      const initial = (memo as typeof initialStateRef.current) ?? initialStateRef.current;
      const deltaTime = pixelsToTime(mx, zoomLevel);

      // Calculate new start time and duration
      let newStartTime = initial.startTime + deltaTime;
      let newDuration = initial.duration - deltaTime;
      let newSourceStartTime = initial.sourceStartTime + deltaTime;

      // Constraints
      // Can't move start before timeline start
      newStartTime = Math.max(0, newStartTime);
      // Can't make duration smaller than minimum
      newDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      // For finite clips, can't trim past source start
      if (hasFiniteDuration(clip)) {
        newSourceStartTime = Math.max(0, newSourceStartTime);
        const maxTrim = initial.sourceStartTime;
        if (deltaTime < -maxTrim) {
          newStartTime = initial.startTime - maxTrim;
          newDuration = initial.duration + maxTrim;
          newSourceStartTime = 0;
        }
      }

      // Generate snap points and try to snap
      const snapPoints = generateSnapPoints(
        Array.from(clips.values()),
        clip.id,
        currentTime,
        totalDuration
      );

      const snapThreshold = calculateSnapThreshold(zoomLevel, SNAP_THRESHOLD_PX);
      const snapResult = snapTrimPosition("start", newStartTime, snapPoints, snapThreshold);

      if (snapResult.snapped && snapResult.snapPoint) {
        const snappedStart = snapResult.snappedTime;
        const timeDelta = snappedStart - initial.startTime;

        // Recalculate with snapped position
        newStartTime = snappedStart;
        newDuration = initial.duration - timeDelta;
        newSourceStartTime = initial.sourceStartTime + timeDelta;

        // Validate constraints again
        if (newDuration >= MIN_CLIP_DURATION && newSourceStartTime >= 0) {
          const snapX = timeToPixels(snapResult.snapPoint.time, zoomLevel);
          showSnapGuide(setSnapGuide, snapX, "Snap");
        }
      } else {
        hideSnapGuide(setSnapGuide);
      }

      // Apply the trim
      trimClip(clip.id, "left", newDuration, newStartTime, newSourceStartTime);

      if (last) {
        setIsTrimming(false);
        setTrimSide(null);
        setTrimming(false);
        hideSnapGuide(setSnapGuide);
      }

      return memo;
    },
    {
      filterTaps: true,
      threshold: 3,
      pointer: { touch: true },
    }
  );

  // Right trim handle
  const bindRight = useDrag(
    ({ movement: [mx], first, last, cancel, memo }) => {
      if (disabled) {
        cancel();
        return;
      }

      if (first) {
        initialStateRef.current = {
          startTime: clip.startTime,
          duration: clip.duration,
          sourceStartTime: clip.sourceStartTime,
        };
        setIsTrimming(true);
        setTrimSide("right");
        setTrimming(true, clip.id);
        saveToHistory();
        return initialStateRef.current;
      }

      const initial = (memo as typeof initialStateRef.current) ?? initialStateRef.current;
      const deltaTime = pixelsToTime(mx, zoomLevel);

      // Calculate new duration
      let newDuration = initial.duration + deltaTime;

      // Constraints
      // Minimum duration
      newDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      // Can't extend past timeline end
      // newDuration = Math.min(totalDuration - clip.startTime, newDuration);
      // For finite clips, can't extend past source duration
      if (hasFiniteDuration(clip) && clip.maxDuration !== undefined) {
        const maxExtend = clip.maxDuration - initial.sourceStartTime;
        newDuration = Math.min(maxExtend, newDuration);
      }

      // Generate snap points and try to snap
      const snapPoints = generateSnapPoints(
        Array.from(clips.values()),
        clip.id,
        currentTime,
        totalDuration
      );

      const snapThreshold = calculateSnapThreshold(zoomLevel, SNAP_THRESHOLD_PX);
      const endTime = clip.startTime + newDuration;
      const snapResult = snapTrimPosition("end", endTime, snapPoints, snapThreshold);

      if (snapResult.snapped && snapResult.snapPoint) {
        const snappedEnd = snapResult.snappedTime;
        const snappedDuration = snappedEnd - clip.startTime;

        // Validate constraints
        if (snappedDuration >= MIN_CLIP_DURATION) {
          if (!hasFiniteDuration(clip) || !clip.maxDuration || snappedDuration <= clip.maxDuration - clip.sourceStartTime) {
            newDuration = snappedDuration;
            const snapX = timeToPixels(snapResult.snapPoint.time, zoomLevel);
            showSnapGuide(setSnapGuide, snapX, "Snap");
          }
        }
      } else {
        hideSnapGuide(setSnapGuide);
      }

      // Apply the trim
      trimClip(clip.id, "right", newDuration);

      if (last) {
        setIsTrimming(false);
        setTrimSide(null);
        setTrimming(false);
        hideSnapGuide(setSnapGuide);
      }

      return memo;
    },
    {
      filterTaps: true,
      threshold: 3,
      pointer: { touch: true },
    }
  );

  return {
    bindLeft,
    bindRight,
    isTrimming,
    trimSide,
    canExtendLeft,
    canExtendRight,
  };
}
