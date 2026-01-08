import { useTimelineStore } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";

interface SelectionWrapperProps {
  clipId: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps preview elements (text, stickers) with selection capability.
 * Shows selection handles (CapCut-style) when the clip is selected.
 */
export function SelectionWrapper({
  clipId,
  children,
  className,
  style,
}: SelectionWrapperProps) {
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const selectClip = useTimelineStore((state) => state.selectClip);

  const isSelected = selectedClipIds.includes(clipId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clipId, e.shiftKey);
  };

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-shadow duration-100",
        isSelected && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent",
        className
      )}
      style={style}
      onClick={handleClick}
    >
      {children}

      {/* Selection handles - only show when selected */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full" />

          {/* Edge handles (center of each edge) */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-2 border-cyan-400 rounded-full" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-2 border-cyan-400 rounded-full" />
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-cyan-400 rounded-full" />
          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-cyan-400 rounded-full" />
        </>
      )}
    </div>
  );
}
