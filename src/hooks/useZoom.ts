import { useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from "@/constants/timeline.constants";

interface UseZoomOptions {
  onZoomChange?: (level: number) => void;
}

export function useZoom(options: UseZoomOptions = {}) {
  const { onZoomChange } = options;

  const { zoomLevel, setZoom, setZoomAroundPoint } = useTimelineStore();

  // Set zoom to a specific level
  const setZoomLevel = useCallback(
    (level: number) => {
      const clampedLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
      setZoom(clampedLevel);
      onZoomChange?.(clampedLevel);
    },
    [setZoom, onZoomChange]
  );

  // Zoom in by a factor
  const zoomIn = useCallback(
    (factor: number = 1.2) => {
      const newLevel = Math.min(MAX_ZOOM, zoomLevel * factor);
      setZoomLevel(newLevel);
    },
    [zoomLevel, setZoomLevel]
  );

  // Zoom out by a factor
  const zoomOut = useCallback(
    (factor: number = 1.2) => {
      const newLevel = Math.max(MIN_ZOOM, zoomLevel / factor);
      setZoomLevel(newLevel);
    },
    [zoomLevel, setZoomLevel]
  );

  // Zoom to fit content
  const zoomToFit = useCallback(
    (contentDuration: number, viewportWidth: number) => {
      const targetZoom = viewportWidth / contentDuration;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
      setZoomLevel(clampedZoom);
    },
    [setZoomLevel]
  );

  // Zoom to show a specific time range
  const zoomToRange = useCallback(
    (startTime: number, endTime: number, viewportWidth: number, padding: number = 50) => {
      const duration = endTime - startTime;
      const targetZoom = (viewportWidth - padding * 2) / duration;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
      setZoomLevel(clampedZoom);
    },
    [setZoomLevel]
  );

  // Reset to default zoom
  const resetZoom = useCallback(() => {
    setZoomLevel(DEFAULT_ZOOM);
  }, [setZoomLevel]);

  // Zoom around a specific point (for pinch-to-zoom)
  const zoomAroundPoint = useCallback(
    (newLevel: number, centerX: number) => {
      const clampedLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newLevel));
      setZoomAroundPoint(clampedLevel, centerX);
      onZoomChange?.(clampedLevel);
    },
    [setZoomAroundPoint, onZoomChange]
  );

  // Get zoom percentage
  const zoomPercentage = Math.round((zoomLevel / DEFAULT_ZOOM) * 100);

  return {
    zoomLevel,
    zoomPercentage,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    defaultZoom: DEFAULT_ZOOM,
    setZoomLevel,
    zoomIn,
    zoomOut,
    zoomToFit,
    zoomToRange,
    resetZoom,
    zoomAroundPoint,
  };
}
