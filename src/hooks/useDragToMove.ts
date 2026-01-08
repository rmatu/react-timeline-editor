import { useState, useCallback, useRef, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TextClip } from "@/schemas";

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startPosX: number;
  startPosY: number;
}

/**
 * Hook to enable drag-to-move for preview elements (text clips, stickers).
 * Updates clip position in the store on drag end.
 */
export function useDragToMove(clip: TextClip, containerRef: React.RefObject<HTMLElement | null>) {
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: clip.position.x,
    startPosY: clip.position.y,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: clip.position.x,
      startPosY: clip.position.y,
    };

    setDragOffset({ x: 0, y: 0 });
  }, [clip.position.x, clip.position.y]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      // Calculate delta as percentage of container
      const deltaX = ((e.clientX - dragStateRef.current.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStateRef.current.startY) / rect.height) * 100;

      setDragOffset({ x: deltaX, y: deltaY });
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current.isDragging) return;

      const { startPosX, startPosY } = dragStateRef.current;
      const newX = Math.max(0, Math.min(100, startPosX + dragOffset.x));
      const newY = Math.max(0, Math.min(100, startPosY + dragOffset.y));

      // Only update if position actually changed
      if (dragOffset.x !== 0 || dragOffset.y !== 0) {
        saveToHistory();
        updateClip(clip.id, {
          position: { x: newX, y: newY },
        });
      }

      dragStateRef.current.isDragging = false;
      setDragOffset({ x: 0, y: 0 });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [clip.id, dragOffset, updateClip, saveToHistory, containerRef]);

  // Calculate current visual position (original + drag offset)
  const visualPosition = {
    x: clip.position.x + dragOffset.x,
    y: clip.position.y + dragOffset.y,
  };

  return {
    handleMouseDown,
    isDragging: dragStateRef.current.isDragging,
    visualPosition,
  };
}
