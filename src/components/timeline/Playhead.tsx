import { useCallback, useRef } from "react";
import { useDrag } from "@use-gesture/react";
import { cn } from "@/lib/utils";
import { PLAYHEAD_WIDTH, PLAYHEAD_HEAD_SIZE } from "@/constants/timeline.constants";

interface PlayheadProps {
  currentTime: number;
  zoomLevel: number;
  scrollX: number;
  height?: number; // Optional, reserved for future use
  onSeek: (time: number) => void;
}

export function Playhead({
  currentTime,
  zoomLevel,
  scrollX,
  // height is passed but not currently used - reserved for future enhancements
  onSeek,
}: PlayheadProps) {
  const isDragging = useRef(false);

  // Calculate playhead position
  const x = currentTime * zoomLevel - scrollX;

  // Handle playhead dragging
  const bind = useDrag(
    ({ movement: [mx], first, last, memo }) => {
      if (first) {
        isDragging.current = true;
        return currentTime;
      }

      const startTime = memo as number;
      const deltaTime = mx / zoomLevel;
      const newTime = Math.max(0, startTime + deltaTime);
      onSeek(newTime);

      if (last) {
        isDragging.current = false;
      }

      return memo;
    },
    {
      filterTaps: true,
    }
  );

  // Handle click on playhead line to prevent timeline click-through
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={cn(
        "playhead absolute top-0 bottom-0 z-50",
        isDragging.current && "cursor-grabbing"
      )}
      style={{
        left: x,
        transform: "translateX(-50%)",
      }}
      onClick={handleClick}
    >
      {/* Playhead handle (draggable) */}
      <div
        {...bind()}
        className="playhead-handle absolute top-0 left-1/2 -translate-x-1/2 cursor-grab pointer-events-auto z-50 group"
        style={{ touchAction: "none" }}
      >
        {/* Hit area for easier grabbing */}
        <div className="absolute -top-4 -left-4 right-4 bottom-4 w-8 h-8 opacity-0" />
        
        <svg
          width={PLAYHEAD_HEAD_SIZE}
          height={PLAYHEAD_HEAD_SIZE}
          viewBox="0 0 12 12"
          className="fill-red-500 transition-transform group-hover:scale-110"
        >
          <path d="M6 12L0 4V0H12V4L6 12Z" />
        </svg>
      </div>

      {/* Playhead line */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-red-500 pointer-events-none"
        style={{
          width: PLAYHEAD_WIDTH,
        }}
      />

      {/* Playhead shadow for better visibility */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-red-500/20 pointer-events-none"
        style={{
          width: 6,
        }}
      />
    </div>
  );
}
