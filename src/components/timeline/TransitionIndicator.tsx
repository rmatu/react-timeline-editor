import { memo, useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { timeToPixels } from "@/utils/time";
import type { Clip } from "@/schemas";
import { cn } from "@/lib/utils";

interface TransitionIndicatorProps {
  clip: Clip;
  side: "in" | "out";
  zoomLevel: number;
  isSelected: boolean;
  onRemove?: () => void;
}

/**
 * Visual indicator for clip transitions on the timeline.
 * Shows a diagonal gradient pattern and allows transition removal.
 */
export const TransitionIndicator = memo(function TransitionIndicator({
  clip,
  side,
  zoomLevel,
  isSelected,
  onRemove,
}: TransitionIndicatorProps) {
  const transition = side === "in" ? clip.transitionIn : clip.transitionOut;
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);
  const removeClipTransition = useTimelineStore((state) => state.removeClipTransition);

  if (!transition) return null;

  const width = timeToPixels(transition.duration, zoomLevel);

  // Get icon/label for transition type
  const getTransitionIcon = () => {
    const { type } = transition;
    if (type === "fade" || type === "dissolve") return "○";
    if (type.includes("slide")) return "→";
    if (type.includes("push")) return "⇒";
    if (type.includes("wipe")) return "▶";
    if (type === "zoom-in") return "+";
    if (type === "zoom-out") return "−";
    return "◇";
  };

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRemove) {
        onRemove();
      } else {
        saveToHistory();
        removeClipTransition(clip.id, side);
      }
    },
    [clip.id, side, saveToHistory, removeClipTransition, onRemove]
  );

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 pointer-events-auto",
        "flex items-center justify-center",
        "group cursor-pointer transition-colors",
        side === "in" ? "left-0" : "right-0"
      )}
      style={{ width: Math.max(width, 8) }}
      title={`${side === "in" ? "In" : "Out"}: ${transition.type} (${transition.duration.toFixed(1)}s)`}
    >
      {/* Gradient overlay to show transition area */}
      <div
        className={cn(
          "absolute inset-0",
          "bg-gradient-to-r",
          side === "in"
            ? "from-black/60 to-transparent"
            : "from-transparent to-black/60"
        )}
      />

      {/* Diagonal lines pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `repeating-linear-gradient(
            ${side === "in" ? "45deg" : "-45deg"},
            transparent,
            transparent 2px,
            rgba(255,255,255,0.3) 2px,
            rgba(255,255,255,0.3) 4px
          )`,
        }}
      />

      {/* Transition type icon - show when wide enough */}
      {width > 20 && (
        <span className="relative text-white/80 text-[10px] font-bold z-10 drop-shadow">
          {getTransitionIcon()}
        </span>
      )}

      {/* Remove button - show on hover when selected */}
      {isSelected && width > 30 && (
        <button
          className={cn(
            "absolute top-0.5 opacity-0 group-hover:opacity-100",
            "w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400",
            "flex items-center justify-center",
            "text-white text-[8px] font-bold",
            "transition-opacity z-20",
            side === "in" ? "left-0.5" : "right-0.5"
          )}
          onClick={handleRemoveClick}
          title={`Remove ${side} transition`}
        >
          ×
        </button>
      )}
    </div>
  );
});
