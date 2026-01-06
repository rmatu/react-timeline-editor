import { useEffect, useCallback, type RefObject } from "react";
import { useGesture } from "@use-gesture/react";
import {
  MIN_ZOOM,
  MAX_ZOOM,
} from "@/constants/timeline.constants";

interface UseTimelineGesturesOptions {
  zoomLevel: number;
  scrollX: number;
  scrollY: number;
  onZoom: (level: number, centerX: number) => void;
  onScroll: (x: number, y: number) => void;
  onScrollBy: (dx: number, dy: number) => void;
}

export function useTimelineGestures(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseTimelineGesturesOptions
) {
  const { zoomLevel, onZoom, onScrollBy } = options;

  // Prevent default touch actions on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaults = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    container.addEventListener("touchmove", preventDefaults, { passive: false });
    return () => {
      container.removeEventListener("touchmove", preventDefaults);
    };
  }, [containerRef]);

  // Main gesture handler
  useGesture(
    {
      // Pinch-to-zoom
      onPinch: ({ offset: [scale], origin: [ox], event }) => {
        event?.preventDefault();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const centerX = ox - rect.left;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * scale));
        onZoom(newZoom, centerX);
      },

      onPinchEnd: () => {
        // Reset any temporary states
      },

      // Mouse wheel handling
      onWheel: ({ delta: [dx, dy], ctrlKey, metaKey, shiftKey, event }) => {
        event.preventDefault();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Ctrl/Cmd + wheel = zoom
        if (ctrlKey || metaKey) {
          const centerX = (event as WheelEvent).clientX - rect.left;
          const zoomFactor = 1 - dy * 0.002;
          const newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoomLevel * zoomFactor)
          );
          onZoom(newZoom, centerX);
          return;
        }

        // Shift + wheel = horizontal scroll
        if (shiftKey) {
          onScrollBy(dy, 0);
          return;
        }

        // Regular wheel = scroll (vertical or horizontal depending on direction)
        if (Math.abs(dx) > Math.abs(dy)) {
          onScrollBy(dx, 0);
        } else {
          onScrollBy(0, dy);
        }
      },

      // Drag to scroll (when not on a clip)
      onDrag: ({ delta: [dx, dy], event, first, pinching, memo }) => {
        // Don't scroll during pinch
        if (pinching) return;

        // Check on first event if we should skip scrolling (started on a clip or trim handle)
        if (first) {
          const target = event?.target as HTMLElement;
          const onClipOrHandle = target?.closest(".clip") || target?.closest(".trim-handle");
          // Return true to memo if we should skip, this persists for the whole gesture
          if (onClipOrHandle) return true;
          return false;
        }

        // Skip scrolling if memo indicates we started on a clip/handle
        if (memo === true) return memo;

        onScrollBy(-dx, -dy);
        return memo;
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      pinch: {
        scaleBounds: { min: MIN_ZOOM / zoomLevel, max: MAX_ZOOM / zoomLevel },
        rubberband: true,
      },
      wheel: {
        eventOptions: { passive: false },
      },
      drag: {
        filterTaps: true,
        threshold: 5,
      },
    }
  );

  // Keyboard zoom shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Zoom in: = or +
      if ((e.key === "=" || e.key === "+") && !e.shiftKey) {
        e.preventDefault();
        onZoom(
          Math.min(MAX_ZOOM, zoomLevel * 1.2),
          containerRef.current?.clientWidth ? containerRef.current.clientWidth / 2 : 0
        );
      }

      // Zoom out: -
      if (e.key === "-" && !e.shiftKey) {
        e.preventDefault();
        onZoom(
          Math.max(MIN_ZOOM, zoomLevel / 1.2),
          containerRef.current?.clientWidth ? containerRef.current.clientWidth / 2 : 0
        );
      }

      // Scroll with arrow keys
      if (e.key === "ArrowLeft") {
        onScrollBy(-50, 0);
      }
      if (e.key === "ArrowRight") {
        onScrollBy(50, 0);
      }
      if (e.key === "ArrowUp" && !e.metaKey && !e.ctrlKey) {
        onScrollBy(0, -50);
      }
      if (e.key === "ArrowDown" && !e.metaKey && !e.ctrlKey) {
        onScrollBy(0, 50);
      }
    },
    [zoomLevel, onZoom, onScrollBy, containerRef]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
