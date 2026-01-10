import { useCallback } from "react";
import type { TransitionType } from "@/schemas/transition.schema";
import { GripVertical, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Transition drag data for drop on clips
export interface TransitionDragData {
  type: "transition-item";
  transitionType: TransitionType;
  side: "in" | "out" | "both"; // Which side to apply
}

// Group transitions by category for better UX
const TRANSITION_GROUPS = {
  Basic: ["fade", "dissolve"] as TransitionType[],
  Slide: ["slide-left", "slide-right", "slide-up", "slide-down"] as TransitionType[],
  Wipe: ["wipe-left", "wipe-right", "wipe-up", "wipe-down"] as TransitionType[],
  Zoom: ["zoom-in", "zoom-out"] as TransitionType[],
  Push: ["push-left", "push-right", "push-up", "push-down"] as TransitionType[],
};

// Labels for display
const TRANSITION_LABELS: Record<TransitionType, string> = {
  fade: "Fade",
  dissolve: "Dissolve",
  "slide-left": "Slide Left",
  "slide-right": "Slide Right",
  "slide-up": "Slide Up",
  "slide-down": "Slide Down",
  "wipe-left": "Wipe Left",
  "wipe-right": "Wipe Right",
  "wipe-up": "Wipe Up",
  "wipe-down": "Wipe Down",
  "zoom-in": "Zoom In",
  "zoom-out": "Zoom Out",
  "push-left": "Push Left",
  "push-right": "Push Right",
  "push-up": "Push Up",
  "push-down": "Push Down",
};

// Icons/preview for each transition type
const getTransitionPreview = (type: TransitionType): string => {
  if (type === "fade" || type === "dissolve") return "○";
  if (type.includes("left")) return "←";
  if (type.includes("right")) return "→";
  if (type.includes("up")) return "↑";
  if (type.includes("down")) return "↓";
  if (type === "zoom-in") return "+";
  if (type === "zoom-out") return "−";
  return "◇";
};

// Color for each category
const CATEGORY_COLORS: Record<string, string> = {
  Basic: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Slide: "bg-green-500/20 text-green-400 border-green-500/30",
  Wipe: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Zoom: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Push: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

interface TransitionTileProps {
  type: TransitionType;
  category: string;
}

// Custom MIME type to identify transition drags during dragover
export const TRANSITION_DRAG_TYPE = "application/x-timeline-transition";

function TransitionTile({ type, category }: TransitionTileProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const dragData: TransitionDragData = {
        type: "transition-item",
        transitionType: type,
        side: "both", // Default to applying to both sides
      };
      // Set custom type so we can detect transition drags during dragover
      e.dataTransfer.setData(TRANSITION_DRAG_TYPE, "true");
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "copy";
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
      }
    },
    [type]
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`
        group flex items-center gap-2 p-2 rounded-lg border
        cursor-grab active:cursor-grabbing transition-all duration-150
        hover:scale-[1.02] hover:shadow-lg
        ${CATEGORY_COLORS[category]}
      `}
    >
      {/* Drag Handle */}
      <div className="text-current/60 group-hover:text-current transition-colors">
        <GripVertical size={12} />
      </div>

      {/* Preview icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded bg-current/10 text-lg font-bold">
        {getTransitionPreview(type)}
      </div>

      {/* Label */}
      <span className="text-xs font-medium text-current flex-1">
        {TRANSITION_LABELS[type]}
      </span>
    </div>
  );
}

export function TransitionsPanel() {
  return (
    <div className="flex flex-col h-full p-3 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-300">
        <Sparkles size={16} className="text-purple-400" />
        <span className="text-sm font-medium">Transitions</span>
      </div>

      {/* Instructions */}
      <div className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-2">
        Drag a transition onto a clip to apply it. Drop on the left side for
        "in" transition, right side for "out" transition.
      </div>

      {/* Transition Groups */}
      <ScrollArea className="flex-1 -mx-3">
        <div className="px-3 space-y-4">
          {Object.entries(TRANSITION_GROUPS).map(([category, types]) => (
            <div key={category}>
              <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                {category}
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {types.map((type) => (
                  <TransitionTile key={type} type={type} category={category} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="text-[10px] text-zinc-600 text-center border-t border-zinc-800 pt-2">
        Tip: Click a clip to edit its transitions in the properties panel
      </div>
    </div>
  );
}

// Parse transition drag data from drop event
export function parseTransitionDragData(
  e: React.DragEvent
): TransitionDragData | null {
  try {
    let data = e.dataTransfer.getData("application/json");
    if (!data) {
      data = e.dataTransfer.getData("text/plain");
    }
    if (!data) return null;

    const parsed = JSON.parse(data);
    if (parsed.type === "transition-item" && parsed.transitionType) {
      return parsed as TransitionDragData;
    }
    return null;
  } catch {
    return null;
  }
}
