import { useState, useRef } from "react";
import { useDrag } from "@use-gesture/react";
import { useAtom } from "jotai";
import { useTimelineStore } from "@/stores/timelineStore";
import { snapGuideAtom, showSnapGuide, hideSnapGuide } from "@/components/timeline/SnapGuide";
import {
  generateSnapPoints,
  snapClipPosition,
  calculateSnapThreshold,
} from "@/utils/snapping";
import { pixelsToTime, timeToPixels } from "@/utils/time";
import { SNAP_THRESHOLD_PX } from "@/constants/timeline.constants";
import type { Clip } from "@/schemas";

interface UseClipDragOptions {
  clip: Clip;
  zoomLevel: number;
  disabled?: boolean;
}

export function useClipDrag({ clip, zoomLevel, disabled = false }: UseClipDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [, setSnapGuide] = useAtom(snapGuideAtom);
  const initialTimeRef = useRef(clip.startTime);

  const {
    clips,
    currentTime,
    totalDuration,
    moveClip,
    setDragging,
    saveToHistory,
    selectClip,
    selectedClipIds,
  } = useTimelineStore();

  const bind = useDrag(
    ({ movement: [mx], first, last, cancel, memo }) => {
      if (disabled) {
        cancel();
        return;
      }

      if (first) {
        // Store initial position
        initialTimeRef.current = clip.startTime;
        setIsDragging(true);
        setDragging(true, clip.id);
        saveToHistory();

        // Always select this clip, replacing previous selection unless it's already selected
        // This ensures clicking a new clip deselects previous ones
        if (!selectedClipIds.includes(clip.id)) {
          selectClip(clip.id, false);
        }

        return clip.startTime;
      }

      const startTime = (memo as number) ?? clip.startTime;
      const deltaTime = pixelsToTime(mx, zoomLevel);
      let newStartTime = Math.max(0, startTime + deltaTime);

      // Generate snap points
      const snapPoints = generateSnapPoints(
        Array.from(clips.values()),
        clip.id,
        currentTime,
        totalDuration
      );

      // Calculate snap threshold based on zoom
      const snapThreshold = calculateSnapThreshold(zoomLevel, SNAP_THRESHOLD_PX);

      // Try to snap
      const snapResult = snapClipPosition(
        newStartTime,
        clip.duration,
        snapPoints,
        snapThreshold
      );

      if (snapResult.snapped && snapResult.snapPoint) {
        newStartTime = snapResult.snappedTime;
        const snapX = timeToPixels(snapResult.snapPoint.time, zoomLevel);
        showSnapGuide(setSnapGuide, snapX, getSnapTypeLabel(snapResult.snapPoint.type));
      } else {
        hideSnapGuide(setSnapGuide);
      }

      // Clamp to timeline bounds
      newStartTime = Math.max(0, Math.min(totalDuration - clip.duration, newStartTime));

      // Update drag position for visual feedback
      setDragPosition(timeToPixels(newStartTime, zoomLevel));

      if (last) {
        // Commit the move
        moveClip(clip.id, newStartTime);
        setIsDragging(false);
        setDragging(false);
        setDragPosition(null);
        hideSnapGuide(setSnapGuide);
      }

      return memo;
    },
    {
      filterTaps: true,
      threshold: 5,
      pointer: { touch: true },
    }
  );

  return {
    bind,
    isDragging,
    dragPosition,
  };
}

function getSnapTypeLabel(type: string): string {
  switch (type) {
    case "clip-start":
      return "Clip Start";
    case "clip-end":
      return "Clip End";
    case "playhead":
      return "Playhead";
    case "timeline-start":
      return "Start";
    case "timeline-end":
      return "End";
    default:
      return "Snap";
  }
}
