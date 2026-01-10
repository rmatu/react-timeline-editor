import { useState, useCallback, useRef, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { timeToPixels } from "@/utils/time";

interface MarqueeSelectionProps {
  scrollX: number;
  scrollY: number;
  zoomLevel: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface MarqueeRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Marquee selection component for selecting multiple clips by drawing a rectangle.
 * Renders as an overlay on the timeline viewport.
 * Only active when toolMode is "select".
 */
export function MarqueeSelection({
  scrollX,
  scrollY,
  zoomLevel,
  containerRef,
}: MarqueeSelectionProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  
  const clips = useTimelineStore((s) => s.clips);
  const tracks = useTimelineStore((s) => s.tracks);
  const selectClips = useTimelineStore((s) => s.selectClips);
  const selectedClipIds = useTimelineStore((s) => s.selectedClipIds);
  const toolMode = useTimelineStore((s) => s.toolMode);

  // Calculate clip bounds for intersection testing
  const getClipBounds = useCallback(
    (clipId: string) => {
      const clip = clips.get(clipId);
      if (!clip) return null;

      const track = tracks.get(clip.trackId);
      if (!track) return null;

      // Calculate vertical position based on track order
      const sortedTracks = Array.from(tracks.values()).sort((a, b) => a.order - b.order);
      let top = 0;
      for (const t of sortedTracks) {
        if (t.id === track.id) break;
        top += t.height;
      }

      const left = timeToPixels(clip.startTime, zoomLevel);
      const width = timeToPixels(clip.duration, zoomLevel);
      const height = track.height;

      return { left, top, width, height, right: left + width, bottom: top + height };
    },
    [clips, tracks, zoomLevel]
  );

  // Check if a clip intersects with the marquee rectangle
  const clipIntersectsMarquee = useCallback(
    (clipId: string, rect: MarqueeRect) => {
      const bounds = getClipBounds(clipId);
      if (!bounds) return false;

      // Normalize marquee coordinates (handle any drag direction)
      const marqueeLeft = Math.min(rect.startX, rect.endX);
      const marqueeRight = Math.max(rect.startX, rect.endX);
      const marqueeTop = Math.min(rect.startY, rect.endY);
      const marqueeBottom = Math.max(rect.startY, rect.endY);

      // Check for intersection
      return !(
        bounds.right < marqueeLeft ||
        bounds.left > marqueeRight ||
        bounds.bottom < marqueeTop ||
        bounds.top > marqueeBottom
      );
    },
    [getClipBounds]
  );

  // Handle mouse down to start selection
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only allow marquee selection in "select" tool mode
      if (toolMode !== "select") return;
      
      // Only start marquee on left click without modifiers, and only on empty space
      if (e.button !== 0) return;
      
      // Don't start marquee if clicking on a clip, handle, or other interactive element
      const target = e.target as HTMLElement;
      if (
        target.closest(".clip") ||
        target.closest(".duration-handle") ||
        target.closest(".playhead") ||
        target.closest(".track-header") ||
        target.closest("[data-no-marquee]")
      ) {
        return;
      }

      e.preventDefault();
      
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollX;
      const y = e.clientY - rect.top + scrollY;

      startPosRef.current = { x, y };
      setMarquee({ startX: x, startY: y, endX: x, endY: y });
      setIsSelecting(true);
    },
    [toolMode, containerRef, scrollX, scrollY]
  );

  // Handle mouse move during selection
  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollX;
      const y = e.clientY - rect.top + scrollY;

      setMarquee((prev) =>
        prev ? { ...prev, endX: x, endY: y } : null
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!marquee) {
        setIsSelecting(false);
        return;
      }

      // Find all clips that intersect with the marquee
      const intersectingClipIds: string[] = [];
      for (const clipId of clips.keys()) {
        if (clipIntersectsMarquee(clipId, marquee)) {
          intersectingClipIds.push(clipId);
        }
      }

      // If shift is held, add to existing selection
      if (e.shiftKey) {
        const combined = new Set([...selectedClipIds, ...intersectingClipIds]);
        selectClips(Array.from(combined));
      } else {
        selectClips(intersectingClipIds);
      }

      setMarquee(null);
      setIsSelecting(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSelecting, marquee, clips, clipIntersectsMarquee, selectClips, selectedClipIds, containerRef, scrollX, scrollY]);

  // Calculate visual marquee rectangle
  const visualMarquee = marquee
    ? {
        left: Math.min(marquee.startX, marquee.endX) - scrollX,
        top: Math.min(marquee.startY, marquee.endY) - scrollY,
        width: Math.abs(marquee.endX - marquee.startX),
        height: Math.abs(marquee.endY - marquee.startY),
      }
    : null;

  return (
    <>
      {/* Invisible overlay to capture mouse events */}
      <div
        className="absolute inset-0 z-0"
        onMouseDown={handleMouseDown}
        style={{ cursor: isSelecting ? "crosshair" : undefined }}
      />

      {/* Marquee rectangle */}
      {visualMarquee && visualMarquee.width > 2 && visualMarquee.height > 2 && (
        <div
          className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/20 z-50"
          style={{
            left: visualMarquee.left,
            top: visualMarquee.top,
            width: visualMarquee.width,
            height: visualMarquee.height,
          }}
        />
      )}
    </>
  );
}
