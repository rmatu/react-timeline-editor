import { useState } from "react";
import { useDrag } from "@use-gesture/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { timeToPixels, pixelsToTime } from "@/utils/time";
import { cn } from "@/lib/utils";

interface DurationHandleProps {
  zoomLevel: number;
  totalDuration: number;
  scrollX: number;
}

export function DurationHandle({
  zoomLevel,
  totalDuration,
  scrollX,
}: DurationHandleProps) {
  const { setDuration } = useTimelineStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(totalDuration);

  const bind = useDrag(
    ({ movement: [mx], first, last, memo }) => {
      if (first) {
        setIsDragging(true);
        setDragTime(totalDuration);
        return totalDuration;
      }

      const initialTime = memo as number;
      const deltaTime = pixelsToTime(mx, zoomLevel);
      const newTime = Math.max(1, initialTime + deltaTime);

      setDragTime(newTime);

      if (last) {
        setIsDragging(false);
        setDuration(newTime, true);
      }

      return memo;
    },
    {
      pointer: { touch: true },
    }
  );

  const displayTime = isDragging ? dragTime : totalDuration;
  const left = timeToPixels(displayTime, zoomLevel) - scrollX;

  return (
    <div
      {...bind()}
      className={cn(
        "absolute top-0 bottom-0 w-4 -ml-2 z-30 cursor-ew-resize group touch-none flex flex-col items-center pointer-events-auto",
        "hover:z-40"
      )}
      style={{ left }}
    >
      {/* Handle Line */}
      <div className={cn(
        "w-0.5 h-full transition-colors",
        isDragging ? "bg-blue-500" : "bg-zinc-700 group-hover:bg-blue-400"
      )} />

      {/* Handle Knob (Top) */}
      <div className={cn(
        "absolute top-0 w-3 h-6 rounded-b-sm shadow-sm flex items-center justify-center transition-colors",
        isDragging ? "bg-blue-500 text-white" : "bg-zinc-700 text-zinc-400 group-hover:bg-blue-400 group-hover:text-white"
      )}>
        <div className="w-0.5 h-3 bg-current opacity-50 rounded-full" />
      </div>
    </div>
  );
}
