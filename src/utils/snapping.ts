import type { Clip } from "@/schemas";
import type { SnapPoint, SnapResult, TimeRange } from "@/types";
import { SNAP_THRESHOLD_SECONDS } from "@/constants/timeline.constants";

/**
 * Generate snap points from clips, playhead, and timeline boundaries
 */
export function generateSnapPoints(
  clips: Clip[],
  currentClipId: string | null,
  currentTime: number,
  duration: number,
  visibleRange?: TimeRange
): SnapPoint[] {
  const points: SnapPoint[] = [];

  // Timeline boundaries
  points.push({ time: 0, type: "timeline-start" });
  points.push({ time: duration, type: "timeline-end" });

  // Playhead
  points.push({ time: currentTime, type: "playhead" });

  // Clip edges (excluding the clip being moved)
  for (const clip of clips) {
    if (clip.id === currentClipId) continue;

    // Only include clips in visible range if specified (per img.ly guidance)
    if (visibleRange) {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd < visibleRange.start || clip.startTime > visibleRange.end) {
        continue;
      }
    }

    points.push({
      time: clip.startTime,
      type: "clip-start",
      sourceId: clip.id,
    });

    points.push({
      time: clip.startTime + clip.duration,
      type: "clip-end",
      sourceId: clip.id,
    });
  }

  return points;
}

/**
 * Find the nearest snap point within threshold
 */
export function findNearestSnapPoint(
  targetTime: number,
  snapPoints: SnapPoint[],
  threshold: number = SNAP_THRESHOLD_SECONDS
): SnapResult {
  let nearestPoint: SnapPoint | null = null;
  let minDistance = threshold;

  for (const point of snapPoints) {
    const distance = Math.abs(point.time - targetTime);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }

  if (nearestPoint) {
    return {
      snapped: true,
      snapPoint: nearestPoint,
      snappedTime: nearestPoint.time,
    };
  }

  return {
    snapped: false,
    snapPoint: null,
    snappedTime: targetTime,
  };
}

/**
 * Snap a clip's start time, considering its duration
 */
export function snapClipPosition(
  startTime: number,
  duration: number,
  snapPoints: SnapPoint[],
  threshold: number = SNAP_THRESHOLD_SECONDS
): SnapResult {
  const endTime = startTime + duration;

  // Try snapping the start
  const startSnap = findNearestSnapPoint(startTime, snapPoints, threshold);

  // Try snapping the end
  const endSnap = findNearestSnapPoint(endTime, snapPoints, threshold);

  // Pick the closer snap
  if (startSnap.snapped && endSnap.snapped) {
    const startDistance = Math.abs(
      startSnap.snappedTime - startTime
    );
    const endDistance = Math.abs(endSnap.snappedTime - endTime);

    if (startDistance <= endDistance) {
      return startSnap;
    } else {
      return {
        snapped: true,
        snapPoint: endSnap.snapPoint,
        snappedTime: endSnap.snappedTime - duration,
      };
    }
  }

  if (startSnap.snapped) {
    return startSnap;
  }

  if (endSnap.snapped) {
    return {
      snapped: true,
      snapPoint: endSnap.snapPoint,
      snappedTime: endSnap.snappedTime - duration,
    };
  }

  return {
    snapped: false,
    snapPoint: null,
    snappedTime: startTime,
  };
}

/**
 * Snap during trim operation (only snap the edge being trimmed)
 */
export function snapTrimPosition(
  _edge: "start" | "end",
  time: number,
  snapPoints: SnapPoint[],
  threshold: number = SNAP_THRESHOLD_SECONDS
): SnapResult {
  // Edge parameter available for future edge-specific snapping logic
  return findNearestSnapPoint(time, snapPoints, threshold);
}

/**
 * Calculate snap threshold in seconds based on zoom level
 * Provides consistent snap feel regardless of zoom
 */
export function calculateSnapThreshold(
  zoomLevel: number,
  baseThresholdPx: number = 8
): number {
  return baseThresholdPx / zoomLevel;
}

/**
 * Check if two clips would overlap
 */
export function wouldClipsOverlap(
  clip: Clip,
  newStartTime: number,
  otherClips: Clip[],
  trackId: string
): boolean {
  const newEndTime = newStartTime + clip.duration;

  for (const other of otherClips) {
    if (other.id === clip.id) continue;
    if (other.trackId !== trackId) continue;

    const otherEnd = other.startTime + other.duration;

    // Check for overlap
    if (newStartTime < otherEnd && newEndTime > other.startTime) {
      return true;
    }
  }

  return false;
}

/**
 * Find the nearest gap for a clip on a track
 */
export function findNearestGap(
  clip: Clip,
  targetTime: number,
  otherClips: Clip[],
  trackId: string
): number {
  const trackClips = otherClips
    .filter((c) => c.trackId === trackId && c.id !== clip.id)
    .sort((a, b) => a.startTime - b.startTime);

  if (trackClips.length === 0) {
    return targetTime;
  }

  // Check if target time fits without overlap
  if (!wouldClipsOverlap(clip, targetTime, otherClips, trackId)) {
    return targetTime;
  }

  // Find gaps and snap to the nearest one
  let nearestGapStart = 0;
  let minDistance = Infinity;

  // Check gap at start of timeline
  if (trackClips.length > 0) {
    const firstClip = trackClips[0];
    if (clip.duration <= firstClip.startTime) {
      const distance = Math.abs(targetTime - 0);
      if (distance < minDistance) {
        minDistance = distance;
        nearestGapStart = 0;
      }
    }
  }

  // Check gaps between clips
  for (let i = 0; i < trackClips.length - 1; i++) {
    const current = trackClips[i];
    const next = trackClips[i + 1];
    const gapStart = current.startTime + current.duration;
    const gapEnd = next.startTime;
    const gapDuration = gapEnd - gapStart;

    if (clip.duration <= gapDuration) {
      const distance = Math.abs(targetTime - gapStart);
      if (distance < minDistance) {
        minDistance = distance;
        nearestGapStart = gapStart;
      }
    }
  }

  // Check gap after last clip
  const lastClip = trackClips[trackClips.length - 1];
  const gapStart = lastClip.startTime + lastClip.duration;
  const distance = Math.abs(targetTime - gapStart);
  if (distance < minDistance) {
    nearestGapStart = gapStart;
  }

  return nearestGapStart;
}
