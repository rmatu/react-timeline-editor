import { useMemo } from "react";
import { timeToPixels } from "@/utils/time";
import type { Clip } from "@/schemas";

interface GhostOutlineProps {
  clip: Clip;
  zoomLevel: number;
  trimSide: "left" | "right" | null;
}

export function GhostOutline({ clip, zoomLevel, trimSide }: GhostOutlineProps) {
  const maxDuration = clip.maxDuration;
  if (!maxDuration) return null;

  // Calculate ghost outline bounds
  const { left, width } = useMemo(() => {
    // For video/audio clips, the max extent is determined by source duration
    const sourceStartTime = clip.sourceStartTime;

    if (trimSide === "left") {
      // Ghost shows how far left we can extend (back into the source)
      const maxExtendLeft = sourceStartTime;
      const ghostStart = clip.startTime - maxExtendLeft;
      const ghostEnd = clip.startTime + clip.duration;
      return {
        left: timeToPixels(ghostStart, zoomLevel),
        width: timeToPixels(ghostEnd - ghostStart, zoomLevel),
      };
    } else if (trimSide === "right") {
      // Ghost shows how far right we can extend
      const remainingDuration = maxDuration - sourceStartTime - clip.duration;
      const ghostStart = clip.startTime;
      const ghostEnd = clip.startTime + clip.duration + remainingDuration;
      return {
        left: timeToPixels(ghostStart, zoomLevel),
        width: timeToPixels(ghostEnd - ghostStart, zoomLevel),
      };
    }

    // Show full possible extent
    const ghostStart = clip.startTime - sourceStartTime;
    return {
      left: timeToPixels(ghostStart, zoomLevel),
      width: timeToPixels(maxDuration, zoomLevel),
    };
  }, [clip, zoomLevel, trimSide, maxDuration]);

  return (
    <div
      className="ghost-outline pointer-events-none absolute top-1 bottom-1 border-2 border-dashed border-zinc-500/50 bg-zinc-500/10"
      style={{
        left,
        width,
        borderRadius: 4,
      }}
    >
      {/* Marching ants animation is applied via CSS */}
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="8 8"
          className="ghost-outline animate-marching-ants text-zinc-400/50"
          rx="3"
        />
      </svg>
    </div>
  );
}
