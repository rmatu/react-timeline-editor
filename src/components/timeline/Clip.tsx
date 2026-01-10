import { memo, useCallback, useMemo, useState } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { TrimHandle } from "./TrimHandle";
import { GhostOutline } from "./GhostOutline";
import { ClipContent } from "./ClipContent";
import { KeyframeMarkers } from "./KeyframeMarkers";
import { TransitionIndicator } from "./TransitionIndicator";
import { parseTransitionDragData, TRANSITION_DRAG_TYPE } from "@/components/sidepanel/panels/TransitionsPanel";
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
  const { isTrimming: isAnyTrimming, currentTime } = useTimelineStore();
  const setClipTransition = useTimelineStore((s) => s.setClipTransition);
  const saveToHistory = useTimelineStore((s) => s.saveToHistory);

  const [isHovered, setIsHovered] = useState(false);
  const [isTransitionDragOver, setIsTransitionDragOver] = useState<"in" | "out" | null>(null);

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

  // Handle click to select and seek playhead to clip start (only if not already on clip)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      const multi = e.metaKey || e.ctrlKey || e.shiftKey;
      onSelect(clip.id, multi);
      
      // Only seek playhead to clip start if not already within the clip's time range
      const clipEnd = clip.startTime + clip.duration;
      const isPlayheadOnClip = currentTime >= clip.startTime && currentTime < clipEnd;
      if (!isPlayheadOnClip) {
        useTimelineStore.getState().setCurrentTime(clip.startTime);
      }
    },
    [clip.id, clip.startTime, clip.duration, currentTime, onSelect, disabled]
  );

  // Handle double-click (could open clip editor)
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Open clip properties editor
    },
    []
  );

  // Handle transition drag over - determine which side based on cursor position
  const handleTransitionDragOver = useCallback(
    (e: React.DragEvent) => {
      // Check for transition drag type (getData returns empty during dragover)
      if (!e.dataTransfer.types.includes(TRANSITION_DRAG_TYPE)) return;

      e.preventDefault();
      e.stopPropagation();

      // Determine which side based on cursor position within the clip
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const clipCenter = rect.width / 2;

      if (relativeX < clipCenter) {
        setIsTransitionDragOver("in");
      } else {
        setIsTransitionDragOver("out");
      }
    },
    []
  );

  const handleTransitionDragLeave = useCallback(() => {
    setIsTransitionDragOver(null);
  }, []);

  const handleTransitionDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const transitionData = parseTransitionDragData(e);
      if (!transitionData) {
        setIsTransitionDragOver(null);
        return;
      }

      // Audio clips don't support visual transitions
      if (clip.type === "audio") {
        setIsTransitionDragOver(null);
        return;
      }

      saveToHistory();

      // Apply based on which side was highlighted or both
      if (transitionData.side === "both") {
        // Use the highlighted side from drag over
        if (isTransitionDragOver === "in" || isTransitionDragOver === "out") {
          setClipTransition(clip.id, isTransitionDragOver, transitionData.transitionType);
        }
      } else {
        setClipTransition(clip.id, transitionData.side, transitionData.transitionType);
      }

      setIsTransitionDragOver(null);
    },
    [clip.id, clip.type, isTransitionDragOver, saveToHistory, setClipTransition]
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
          "transition-shadow",
          isSelected
            ? "border-2 border-blue-500 shadow-lg shadow-blue-500/20"
            : clip.type === "text"
            ? "border-2 border-white/20 hover:border-white/40" // Text clips always have a subtle border
            : "border-0 hover:border-2 hover:border-white/20", // No border by default, show on hover
          isDragging && "dragging opacity-80 shadow-xl z-50", // Increased z-index
          isTrimming && "z-20",
          disabled && "cursor-not-allowed",
          // Transition drop highlights
          isTransitionDragOver && "ring-2 ring-purple-400"
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
        onDragOver={handleTransitionDragOver}
        onDragLeave={handleTransitionDragLeave}
        onDrop={handleTransitionDrop}
      >
        {/* Transition drop zone indicator */}
        {isTransitionDragOver && (
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1/2 pointer-events-none",
              "bg-purple-400/20 border-2 border-purple-400 border-dashed",
              isTransitionDragOver === "in" ? "left-0 rounded-l" : "right-0 rounded-r"
            )}
          >
            <div className="absolute inset-0 flex items-center justify-center text-purple-300 text-xs font-medium">
              {isTransitionDragOver === "in" ? "In" : "Out"}
            </div>
          </div>
        )}

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

        {/* Clip name/label - hide for text as it renders its own content */}
        {width > 60 && clip.type !== "text" && (
          <div className="absolute inset-x-2 top-1 truncate text-xs font-medium text-white/80 drop-shadow-sm">
            {clip.type === "video" || clip.type === "audio"
              ? (clip as any).name || getFileName((clip as any).sourceUrl)
              : clip.type}
          </div>
        )}

        {/* Duration badge - always show in bottom right corner */}
        {width > 50 && (
          <div className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 py-px text-[9px] font-mono text-white/70">
            {clip.duration >= 60 
              ? `${Math.floor(clip.duration / 60)}:${(clip.duration % 60).toFixed(1).padStart(4, '0')}`
              : `${clip.duration.toFixed(1)}s`}
          </div>
        )}

        {/* Muted indicator */}
        {clip.muted && (
          <div className="absolute right-1 top-1 rounded bg-red-500/80 px-1 text-[10px] text-white">
            M
          </div>
        )}

        {/* Keyframe markers - show when clip has keyframes */}
        {clip.keyframes && clip.keyframes.length > 0 && (
          <KeyframeMarkers
            clip={clip}
            zoomLevel={zoomLevel}
            currentTime={currentTime}
            onKeyframeClick={(_kfId, e) => {
              e.stopPropagation();
              // Select the clip when clicking a keyframe
              onSelect(clip.id, e.metaKey || e.ctrlKey || e.shiftKey);
            }}
          />
        )}

        {/* Transition indicators - show when clip has transitions */}
        {clip.transitionIn && (
          <TransitionIndicator
            clip={clip}
            side="in"
            zoomLevel={zoomLevel}
            isSelected={isSelected}
          />
        )}
        {clip.transitionOut && (
          <TransitionIndicator
            clip={clip}
            side="out"
            zoomLevel={zoomLevel}
            isSelected={isSelected}
          />
        )}
      </div>
    </>
  );
});

// Helper to extract filename from URL (works with both absolute and relative URLs)
function getFileName(url: string): string {
  if (!url) return "";
  // Simple approach that works for both absolute and relative URLs
  const filename = url.split("/").pop() || "";
  // Remove any query params
  const cleanName = filename.split("?")[0];
  try {
    return decodeURIComponent(cleanName);
  } catch {
    return cleanName;
  }
}
