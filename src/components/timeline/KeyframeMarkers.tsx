import { memo, useMemo, useCallback } from "react";
import { Diamond } from "lucide-react";
import type { Clip } from "@/schemas";
import type { Keyframe } from "@/schemas/keyframe.schema";
import { timeToPixels } from "@/utils/time";
import { getKeyframesByTime } from "@/utils/keyframes";
import { useKeyframeDrag } from "@/hooks/useKeyframeDrag";
import { cn } from "@/lib/utils";

interface KeyframeMarkersProps {
  clip: Clip;
  zoomLevel: number;
  selectedKeyframeId?: string;
  onKeyframeClick?: (keyframeId: string, e: React.MouseEvent) => void;
}

interface DraggableKeyframeProps {
  clip: Clip;
  time: number;
  keyframes: Keyframe[];
  zoomLevel: number;
  isSelected: boolean;
  onKeyframeClick?: (keyframeId: string, e: React.MouseEvent) => void;
}

// Individual draggable keyframe marker
const DraggableKeyframe = memo(function DraggableKeyframe({
  clip,
  time,
  keyframes,
  zoomLevel,
  isSelected,
  onKeyframeClick,
}: DraggableKeyframeProps) {
  const keyframeIds = useMemo(() => keyframes.map((kf) => kf.id), [keyframes]);
  const propertyCount = keyframes.length;

  const { bind, isDragging, dragOffset } = useKeyframeDrag({
    clipId: clip.id,
    clipDuration: clip.duration,
    keyframeIds,
    initialTime: time,
    zoomLevel,
  });

  const baseLeft = timeToPixels(time, zoomLevel);
  const left = baseLeft + dragOffset;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isDragging) {
        onKeyframeClick?.(keyframes[0].id, e);
      }
    },
    [isDragging, keyframes, onKeyframeClick]
  );

  return (
    <div
      {...bind()}
      className={cn(
        "absolute bottom-1 pointer-events-auto cursor-grab touch-none select-none",
        isDragging && "cursor-grabbing z-50"
      )}
      style={{
        left,
        transform: "translateX(-50%)",
      }}
      onClick={handleClick}
      title={`${propertyCount} keyframe${propertyCount > 1 ? "s" : ""} at ${time.toFixed(2)}s`}
    >
      <Diamond
        size={12}
        className={cn(
          "transition-all drop-shadow-md",
          isDragging
            ? "fill-yellow-300 text-yellow-300 scale-150"
            : isSelected
            ? "fill-yellow-400 text-yellow-400 scale-125"
            : "fill-white/80 text-white/80 hover:fill-yellow-300 hover:text-yellow-300 hover:scale-110"
        )}
      />
      {/* Show dot indicator if multiple properties at same time */}
      {propertyCount > 1 && (
        <div
          className={cn(
            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 border border-blue-600",
            isDragging && "scale-125"
          )}
        />
      )}
    </div>
  );
});

export const KeyframeMarkers = memo(function KeyframeMarkers({
  clip,
  zoomLevel,
  selectedKeyframeId,
  onKeyframeClick,
}: KeyframeMarkersProps) {
  // Group keyframes by time for rendering (multiple properties can share same time)
  const keyframeGroups = useMemo(() => {
    if (!clip.keyframes?.length) return [];

    const grouped = getKeyframesByTime(clip.keyframes);
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [clip.keyframes]);

  if (keyframeGroups.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 h-6 flex items-end pointer-events-none overflow-visible">
      {keyframeGroups.map(([time, keyframes]) => {
        const isSelected = keyframes.some((kf) => kf.id === selectedKeyframeId);

        return (
          <DraggableKeyframe
            key={`${time}-${keyframes.map((k) => k.id).join("-")}`}
            clip={clip}
            time={time}
            keyframes={keyframes}
            zoomLevel={zoomLevel}
            isSelected={isSelected}
            onKeyframeClick={onKeyframeClick}
          />
        );
      })}
    </div>
  );
});
