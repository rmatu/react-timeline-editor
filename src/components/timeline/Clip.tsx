import { memo, useCallback, useMemo, useState } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { TrimHandle } from "./TrimHandle";
import { GhostOutline } from "./GhostOutline";
import { ClipContent } from "./ClipContent";
import { useClipDrag } from "@/hooks/useClipDrag";
import { useClipTrim } from "@/hooks/useClipTrim";
import { cn } from "@/lib/utils";
import { timeToPixels } from "@/utils/time";
import { hasFiniteDuration } from "@/schemas";
import { CLIP_BORDER_RADIUS, TRACK_COLORS } from "@/constants/timeline.constants";
import type { Clip as ClipType, Track } from "@/schemas";

interface ClipProps {
  clip: ClipType;
  track: Track;
  zoomLevel: number;
  scrollX: number;
  isSelected: boolean;
  onSelect: (clipId: string, multi: boolean) => void;
  disabled?: boolean;
}

export const Clip = memo(function Clip({
  clip,
  track,
  zoomLevel,
  scrollX: _scrollX,
  isSelected,
  onSelect,
  disabled = false,
}: ClipProps) {
  void _scrollX; // Used for potential future viewport optimizations
  const { isTrimming: isAnyTrimming } = useTimelineStore();

  const [isHovered, setIsHovered] = useState(false);

  // Calculate clip dimensions
  const left = useMemo(
    () => timeToPixels(clip.startTime, zoomLevel),
    [clip.startTime, zoomLevel]
  );
  const width = useMemo(
    () => timeToPixels(clip.duration, zoomLevel),
    [clip.duration, zoomLevel]
  );

  // Clip drag handler
  const {
    bind: bindDrag,
    isDragging,
    dragPosition,
  } = useClipDrag({
    clip,
    zoomLevel,
    disabled: disabled || isAnyTrimming,
  });

  // Clip trim handlers
  const {
    bindLeft,
    bindRight,
    isTrimming,
    trimSide,
    canExtendLeft,
    canExtendRight,
  } = useClipTrim({
    clip,
    zoomLevel,
    disabled,
  });

  // Handle click to select
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      const multi = e.metaKey || e.ctrlKey || e.shiftKey;
      onSelect(clip.id, multi);
    },
    [clip.id, onSelect, disabled]
  );

  // Handle double-click (could open clip editor)
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Open clip properties editor
    },
    []
  );

  // Determine actual position (accounting for drag)
  const actualLeft = isDragging && dragPosition ? dragPosition.x : left;
  const actualTop = isDragging && dragPosition ? dragPosition.y : 0;

  // Get clip color based on type
  const clipColor = track.color || TRACK_COLORS[clip.type];

  // Show ghost outline during trim for finite-duration clips
  const showGhostOutline = isTrimming && hasFiniteDuration(clip) && clip.maxDuration;

  return (
    <>
      {/* Ghost outline for max duration */}
      {showGhostOutline && (
        <GhostOutline
          clip={clip}
          zoomLevel={zoomLevel}
          trimSide={trimSide}
        />
      )}

      {/* Main clip container */}
      <div
        {...bindDrag()}
        className={cn(
          "clip absolute top-1 bottom-1 cursor-pointer overflow-hidden",
          "border-2 transition-shadow",
          isSelected
            ? "border-blue-500 shadow-lg shadow-blue-500/20"
            : "border-transparent hover:border-white/20",
          isDragging && "dragging opacity-80 shadow-xl z-50", // Increased z-index
          isTrimming && "z-20",
          disabled && "cursor-not-allowed"
        )}
        style={{
          left: actualLeft,
          transform: actualTop ? `translateY(${actualTop}px)` : undefined,
          width: Math.max(width, 4), // Minimum visible width
          borderRadius: CLIP_BORDER_RADIUS,
          backgroundColor: clipColor,
          touchAction: "none",
          willChange: isDragging ? "transform, left" : "auto",
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Clip content (type-specific rendering) */}
        <ClipContent clip={clip} width={width} isSelected={isSelected} />

        {/* Selection/hover overlay - only for hover, selection uses border */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none transition-colors",
            isHovered && !isSelected ? "bg-white/5" : "bg-transparent"
          )}
        />

        {/* Trim handles (visible when selected or hovered) */}
        {(isSelected || isHovered) && !disabled && (
          <>
            <TrimHandle
              side="left"
              bind={bindLeft}
              canExtend={canExtendLeft}
              isActive={isTrimming && trimSide === "left"}
            />
            <TrimHandle
              side="right"
              bind={bindRight}
              canExtend={canExtendRight}
              isActive={isTrimming && trimSide === "right"}
            />
          </>
        )}

        {/* Clip name/label */}
        {/* Clip name/label - hide for text as it renders its own content */}
        {width > 60 && clip.type !== "text" && (
          <div className="absolute inset-x-2 top-1 truncate text-xs font-medium text-white/80">
            {clip.type === "video" || clip.type === "audio"
              ? getFileName((clip as any).sourceUrl)
              : clip.type}
          </div>
        )}

        {/* Duration badge (for selected clips under 10s) */}
        {isSelected && clip.duration < 10 && width > 40 && (
          <div className="absolute bottom-1 right-1 rounded bg-black/50 px-1 text-[10px] text-white/70">
            {clip.duration.toFixed(1)}s
          </div>
        )}

        {/* Muted indicator */}
        {clip.muted && (
          <div className="absolute right-1 top-1 rounded bg-red-500/80 px-1 text-[10px] text-white">
            M
          </div>
        )}
      </div>
    </>
  );
});

// Helper to extract filename from URL
function getFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() || "";
    return decodeURIComponent(filename);
  } catch {
    return url;
  }
}
