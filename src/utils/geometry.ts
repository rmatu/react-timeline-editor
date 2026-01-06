import type { Position, TimeRange } from "@/types";
import type { Clip } from "@/schemas";
import { timeToPixels, pixelsToTime } from "./time";

/**
 * Check if two time ranges overlap
 */
export function doRangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Get clip bounds in pixels
 */
export function getClipBounds(
  clip: Clip,
  zoomLevel: number
): { left: number; right: number; width: number } {
  const left = timeToPixels(clip.startTime, zoomLevel);
  const width = timeToPixels(clip.duration, zoomLevel);
  return { left, right: left + width, width };
}

/**
 * Check if a point is within a clip's bounds
 */
export function isPointInClip(
  x: number,
  clip: Clip,
  zoomLevel: number
): boolean {
  const bounds = getClipBounds(clip, zoomLevel);
  return x >= bounds.left && x <= bounds.right;
}

/**
 * Get time at a pixel position relative to timeline
 */
export function getTimeAtPosition(
  x: number,
  scrollX: number,
  zoomLevel: number
): number {
  return pixelsToTime(scrollX + x, zoomLevel);
}

/**
 * Get pixel position for a time value relative to viewport
 */
export function getPositionForTime(
  time: number,
  scrollX: number,
  zoomLevel: number
): number {
  return timeToPixels(time, zoomLevel) - scrollX;
}

/**
 * Check if a clip is visible in the viewport
 */
export function isClipVisible(
  clip: Clip,
  scrollX: number,
  viewportWidth: number,
  zoomLevel: number
): boolean {
  const bounds = getClipBounds(clip, zoomLevel);
  const viewportEnd = scrollX + viewportWidth;
  return bounds.right > scrollX && bounds.left < viewportEnd;
}

/**
 * Get clips visible in viewport
 */
export function getVisibleClips(
  clips: Clip[],
  scrollX: number,
  viewportWidth: number,
  zoomLevel: number
): Clip[] {
  return clips.filter((clip) =>
    isClipVisible(clip, scrollX, viewportWidth, zoomLevel)
  );
}

/**
 * Calculate position for zoom centered on a point
 */
export function calculateZoomCenteredScroll(
  currentScrollX: number,
  currentZoom: number,
  newZoom: number,
  centerX: number
): number {
  // Time at the center point
  const timeAtCenter = pixelsToTime(currentScrollX + centerX, currentZoom);
  // New scroll position to keep that time at the same visual position
  return timeToPixels(timeAtCenter, newZoom) - centerX;
}

/**
 * Constrain scroll position to valid bounds
 */
export function constrainScroll(
  scrollX: number,
  scrollY: number,
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { scrollX: number; scrollY: number } {
  return {
    scrollX: Math.max(0, Math.min(scrollX, contentWidth - viewportWidth)),
    scrollY: Math.max(0, Math.min(scrollY, contentHeight - viewportHeight)),
  };
}

/**
 * Get the track at a Y position
 */
export function getTrackAtPosition(
  y: number,
  trackHeights: number[],
  scrollY: number = 0
): number {
  let accumulatedHeight = 0;
  const adjustedY = y + scrollY;

  for (let i = 0; i < trackHeights.length; i++) {
    accumulatedHeight += trackHeights[i];
    if (adjustedY < accumulatedHeight) {
      return i;
    }
  }

  return trackHeights.length - 1;
}

/**
 * Calculate distance between two points
 */
export function distance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if position is within a rectangular area
 */
export function isPointInRect(
  point: Position,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Calculate the bounding box of multiple clips
 */
export function getClipsBoundingBox(
  clips: Clip[],
  zoomLevel: number
): { left: number; right: number; top: number; bottom: number } | null {
  if (clips.length === 0) return null;

  let left = Infinity;
  let right = -Infinity;

  for (const clip of clips) {
    const bounds = getClipBounds(clip, zoomLevel);
    left = Math.min(left, bounds.left);
    right = Math.max(right, bounds.right);
  }

  return { left, right, top: 0, bottom: 0 };
}
