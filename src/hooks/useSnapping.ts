import { useMemo, useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import {
  generateSnapPoints,
  findNearestSnapPoint,
  snapClipPosition,
  calculateSnapThreshold,
} from "@/utils/snapping";
import type { SnapPoint, SnapResult, TimeRange } from "@/types";
import { SNAP_THRESHOLD_PX } from "@/constants/timeline.constants";

interface UseSnappingOptions {
  excludeClipId?: string;
  visibleRange?: TimeRange;
  enabled?: boolean;
}

export function useSnapping(options: UseSnappingOptions = {}) {
  const { excludeClipId, visibleRange, enabled = true } = options;

  const { clips, currentTime, totalDuration, zoomLevel } = useTimelineStore();

  // Generate snap points
  const snapPoints = useMemo((): SnapPoint[] => {
    if (!enabled) return [];

    return generateSnapPoints(
      Array.from(clips.values()),
      excludeClipId ?? null,
      currentTime,
      totalDuration,
      visibleRange
    );
  }, [clips, excludeClipId, currentTime, totalDuration, visibleRange, enabled]);

  // Calculate snap threshold based on zoom
  const snapThreshold = useMemo(
    () => calculateSnapThreshold(zoomLevel, SNAP_THRESHOLD_PX),
    [zoomLevel]
  );

  // Find nearest snap point
  const findSnapPoint = useCallback(
    (targetTime: number): SnapResult => {
      if (!enabled) {
        return { snapped: false, snapPoint: null, snappedTime: targetTime };
      }
      return findNearestSnapPoint(targetTime, snapPoints, snapThreshold);
    },
    [snapPoints, snapThreshold, enabled]
  );

  // Snap a clip position
  const snapClip = useCallback(
    (startTime: number, duration: number): SnapResult => {
      if (!enabled) {
        return { snapped: false, snapPoint: null, snappedTime: startTime };
      }
      return snapClipPosition(startTime, duration, snapPoints, snapThreshold);
    },
    [snapPoints, snapThreshold, enabled]
  );

  return {
    snapPoints,
    snapThreshold,
    findSnapPoint,
    snapClip,
  };
}
