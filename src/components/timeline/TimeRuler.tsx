import { useMemo, memo, useRef, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { calculateRulerInterval, formatRulerLabel } from "@/utils/time";
import { cn } from "@/lib/utils";
import { MIN_ZOOM, MAX_ZOOM } from "@/constants/timeline.constants";

interface TimeRulerProps {
  duration: number;
  zoomLevel: number;
  scrollX: number;
  onClick?: (e: React.MouseEvent) => void;
}

export const TimeRuler = memo(function TimeRuler({
  duration,
  zoomLevel,
  scrollX,
  onClick,
}: TimeRulerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setZoomAroundPoint = useTimelineStore((state) => state.setZoomAroundPoint);
  
  // Keep zoomLevel in ref to avoid re-attaching event listener
  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        
        const rect = el.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const currentZoom = zoomLevelRef.current; // Use ref
        
        // Similar logic to useTimelineGestures but without modifier key check
        const zoomFactor = 1 - e.deltaY * 0.002;
        const newZoom = Math.max(
          MIN_ZOOM, 
          Math.min(MAX_ZOOM, currentZoom * zoomFactor)
        );
        
        setZoomAroundPoint(newZoom, centerX);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [setZoomAroundPoint]);

  const { majorInterval, minorDivisions } = useMemo(
    () => calculateRulerInterval(zoomLevel),
    [zoomLevel]
  );

  // Generate tick marks within visible range with some overflow
  const ticks = useMemo(() => {
    const result: Array<{
      time: number;
      x: number;
      isMajor: boolean;
      label?: string;
    }> = [];

    const minorInterval = majorInterval / minorDivisions;
    const startTime = Math.floor(scrollX / zoomLevel / majorInterval) * majorInterval;
    const endTime = (scrollX + 2000) / zoomLevel; // Estimate viewport width + buffer (infinite scroll)

    for (let time = startTime; time <= endTime; time += minorInterval) {
      const isMajor = Math.abs(time % majorInterval) < 0.001;
      const x = time * zoomLevel - scrollX;

      result.push({
        time,
        x,
        isMajor,
        label: isMajor ? formatRulerLabel(time) : undefined,
      });
    }

    return result;
  }, [duration, zoomLevel, scrollX, majorInterval, minorDivisions]);

  return (
    <div
      ref={containerRef}
      className="relative h-full cursor-pointer select-none bg-zinc-800"
      onClick={onClick}
    >
      {/* Tick marks */}
      {ticks.map(({ time, x, isMajor, label }) => (
        <div
          key={time}
          className="absolute top-0 bottom-0"
          style={{ left: x }}
        >
          {/* Tick line */}
          <div
            className={cn(
              "absolute bottom-0 w-px",
              isMajor ? "h-3 bg-zinc-400" : "h-2 bg-zinc-600"
            )}
          />

          {/* Label for major ticks */}
          {label && (
            <div className="absolute top-1 -translate-x-1/2 text-xs text-zinc-400">
              {label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
