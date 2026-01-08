import { useState, useRef } from "react";
import { useDrag } from "@use-gesture/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { pixelsToTime, timeToPixels } from "@/utils/time";

interface UseKeyframeDragOptions {
  clipId: string;
  clipDuration: number;
  keyframeIds: string[]; // All keyframe IDs at this time position (may be grouped)
  initialTime: number;
  zoomLevel: number;
  disabled?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useKeyframeDrag({
  clipId,
  clipDuration,
  keyframeIds,
  initialTime,
  zoomLevel,
  disabled = false,
  onDragStart,
  onDragEnd,
}: UseKeyframeDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startTimeRef = useRef(initialTime);

  const { updateKeyframe, saveToHistory } = useTimelineStore();

  const bind = useDrag(
    ({ movement: [mx], first, last, cancel, event }) => {
      // Stop propagation to prevent clip drag
      event?.stopPropagation();

      if (disabled) {
        cancel();
        return;
      }

      if (first) {
        startTimeRef.current = initialTime;
        setIsDragging(true);
        saveToHistory();
        onDragStart?.();
      }

      // Convert pixel movement to time
      const deltaTime = pixelsToTime(mx, zoomLevel);
      let newTime = startTimeRef.current + deltaTime;

      // Clamp within clip bounds
      newTime = Math.max(0, Math.min(clipDuration, newTime));

      // Calculate visual offset in pixels
      const newX = timeToPixels(newTime, zoomLevel);
      const originalX = timeToPixels(initialTime, zoomLevel);
      setDragOffset(newX - originalX);

      if (last) {
        // Update all keyframes at this time position
        keyframeIds.forEach((kfId) => {
          updateKeyframe(clipId, kfId, { time: newTime });
        });

        setIsDragging(false);
        setDragOffset(0);
        onDragEnd?.();
      }
    },
    {
      filterTaps: true,
      threshold: 3,
      pointer: { touch: true },
      axis: "x", // Lock to horizontal movement only
    }
  );

  return {
    bind,
    isDragging,
    dragOffset,
  };
}
