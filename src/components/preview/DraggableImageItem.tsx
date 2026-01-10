import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTimelineStore } from "@/stores/timelineStore";
import type { StickerClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";
import { cn } from "@/lib/utils";
import { RotateCw, Maximize2, Trash2, ArrowUpToLine, ArrowDownToLine } from "lucide-react";
import { useGifAnimation } from "@/hooks/useGifAnimation";
import { Z_INDEX } from "@/constants/timeline.constants";

interface DraggableImageItemProps {
  clip: StickerClip;
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zIndex?: number;
}

type DragMode = "move" | "scale" | "rotate" | null;

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startPosX: number;
  startPosY: number;
  startScale: number;
  startRotation: number;
  centerX: number;
  centerY: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * A sticker/image item that can be selected, dragged, scaled, and rotated within the preview.
 * Supports animated GIFs with synchronized playback.
 */
export function DraggableImageItem({ clip, currentTime, containerRef, zIndex }: DraggableImageItemProps) {
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const selectClip = useTimelineStore((state) => state.selectClip);
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);
  const removeClip = useTimelineStore((state) => state.removeClip);
  const isPlaying = useTimelineStore((state) => state.isPlaying);

  const isSelected = selectedClipIds.includes(clip.id);
  const elementRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0, scale: 0, rotation: 0 });
  const dragDeltaRef = useRef(dragDelta);

  const dragStartRef = useRef<DragState>({
    mode: null,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    startScale: 1,
    startRotation: 0,
    centerX: 0,
    centerY: 0,
    containerWidth: 0,
    containerHeight: 0,
  });

  // Get animated properties at current time
  const animated = getAnimatedPropertiesAtTime(clip, currentTime);

  // Calculate clip-relative time for GIF animation
  const clipTime = currentTime - clip.startTime;

  // For animated GIFs, use the animation hook
  const { canvas: gifCanvas, isLoaded: gifLoaded } = useGifAnimation(
    clip.isAnimated ? clip.assetUrl : null,
    isPlaying,
    clipTime
  );

  // Base values for transforms
  const baseScale = animated.scale;
  const baseRotation = animated.rotation;

  // Context menu actions
  const handleFitToScreen = useCallback(() => {
    saveToHistory();
    updateClip(clip.id, {
      position: { x: 50, y: 50 },
      scale: 1,
      rotation: 0,
    });
    setContextMenu(null);
  }, [clip.id, updateClip, saveToHistory]);

  const handleDelete = useCallback(() => {
    saveToHistory();
    removeClip(clip.id);
    setContextMenu(null);
  }, [clip.id, removeClip, saveToHistory]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectClip(clip.id, false);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [clip.id, selectClip]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    
    const handleClick = () => setContextMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  // Start moving
  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    selectClip(clip.id, e.shiftKey);

    const container = containerRef.current;
    const containerRect = container?.getBoundingClientRect();

    setDragMode("move");
    dragStartRef.current = {
      ...dragStartRef.current,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      startPosX: animated.position.x,
      startPosY: animated.position.y,
      containerWidth: containerRect?.width ?? 0,
      containerHeight: containerRect?.height ?? 0,
    };
  }, [clip.id, animated.position.x, animated.position.y, selectClip, containerRef]);

  // Start scaling
  const handleScaleStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const element = elementRef.current;
    if (!element) return;
    const elementRect = element.getBoundingClientRect();

    const centerX = elementRect.left + elementRect.width / 2;
    const centerY = elementRect.top + elementRect.height / 2;

    setDragMode("scale");
    dragStartRef.current = {
      ...dragStartRef.current,
      mode: "scale",
      startX: e.clientX,
      startY: e.clientY,
      startScale: baseScale,
      centerX,
      centerY,
    };
  }, [baseScale]);

  // Start rotating
  const handleRotateStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const element = elementRef.current;
    if (!element) return;

    const elementRect = element.getBoundingClientRect();
    const centerX = elementRect.left + elementRect.width / 2;
    const centerY = elementRect.top + elementRect.height / 2;

    setDragMode("rotate");
    dragStartRef.current = {
      ...dragStartRef.current,
      mode: "rotate",
      startX: e.clientX,
      startY: e.clientY,
      startRotation: baseRotation,
      centerX,
      centerY,
    };
  }, [baseRotation]);

  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { mode, startX, startY, centerX, centerY } = dragStartRef.current;

      if (mode === "move") {
        const { containerWidth, containerHeight } = dragStartRef.current;
        if (containerWidth === 0 || containerHeight === 0) return;

        const deltaX = ((e.clientX - startX) / containerWidth) * 100;
        const deltaY = ((e.clientY - startY) / containerHeight) * 100;
        const newDelta = { x: deltaX, y: deltaY, scale: 0, rotation: 0 };
        dragDeltaRef.current = newDelta;
        setDragDelta(newDelta);
      }
      else if (mode === "scale") {
        const startDist = Math.sqrt(Math.pow(startX - centerX, 2) + Math.pow(startY - centerY, 2));
        const currentDist = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));
        const scaleDelta = (currentDist / startDist) - 1;
        const newDelta = { x: 0, y: 0, scale: scaleDelta, rotation: 0 };
        dragDeltaRef.current = newDelta;
        setDragDelta(newDelta);
      }
      else if (mode === "rotate") {
        const startAngle = Math.atan2(startY - centerY, startX - centerX);
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const rotationDelta = ((currentAngle - startAngle) * 180) / Math.PI;
        const newDelta = { x: 0, y: 0, scale: 0, rotation: rotationDelta };
        dragDeltaRef.current = newDelta;
        setDragDelta(newDelta);
      }
    };

    const handleMouseUp = () => {
      const { mode, startPosX, startPosY, startScale, startRotation } = dragStartRef.current;
      // Use ref to get latest delta values (avoids stale closure issue)
      const delta = dragDeltaRef.current;

      const hasKeyframesFor = (property: string) =>
        clip.keyframes?.some(kf => kf.property === property) ?? false;

      const MIN_MOVE_THRESHOLD = 0.5;

      if (mode === "move" && (Math.abs(delta.x) > MIN_MOVE_THRESHOLD || Math.abs(delta.y) > MIN_MOVE_THRESHOLD)) {
        saveToHistory();
        const newX = startPosX + delta.x;
        const newY = startPosY + delta.y;

        if (hasKeyframesFor("position")) {
          useTimelineStore.getState().addKeyframeAtCurrentTime(clip.id, "position", { x: newX, y: newY });
        } else {
          updateClip(clip.id, { position: { x: newX, y: newY } });
        }
      } else if (mode === "scale" && delta.scale !== 0) {
        saveToHistory();
        const newScale = Math.max(0.1, Math.min(5, startScale * (1 + delta.scale)));

        if (hasKeyframesFor("scale")) {
          useTimelineStore.getState().addKeyframeAtCurrentTime(clip.id, "scale", newScale);
        } else {
          updateClip(clip.id, { scale: newScale });
        }
      } else if (mode === "rotate" && delta.rotation !== 0) {
        saveToHistory();
        const newRotation = startRotation + delta.rotation;

        if (hasKeyframesFor("rotation")) {
          useTimelineStore.getState().addKeyframeAtCurrentTime(clip.id, "rotation", newRotation);
        } else {
          updateClip(clip.id, { rotation: newRotation });
        }
      }

      setDragMode(null);
      const resetDelta = { x: 0, y: 0, scale: 0, rotation: 0 };
      dragDeltaRef.current = resetDelta;
      setDragDelta(resetDelta);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragMode, clip, updateClip, saveToHistory]);

  // Calculate visual transforms
  const visualX = dragMode === "move"
    ? dragStartRef.current.startPosX + dragDelta.x
    : animated.position.x;
  const visualY = dragMode === "move"
    ? dragStartRef.current.startPosY + dragDelta.y
    : animated.position.y;
  const visualScale = dragMode === "scale"
    ? dragStartRef.current.startScale * (1 + dragDelta.scale)
    : baseScale;
  const visualRotation = dragMode === "rotate"
    ? dragStartRef.current.startRotation + dragDelta.rotation
    : baseRotation;

  // For animated GIFs, we need to update when the canvas changes
  const [gifDataUrl, setGifDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (clip.isAnimated && gifCanvas && gifLoaded) {
      // Update data URL when canvas is available
      const updateFrame = () => {
        setGifDataUrl(gifCanvas.toDataURL());
      };
      updateFrame();

      // Set up interval to capture frames during playback
      if (isPlaying) {
        const interval = setInterval(updateFrame, 50); // ~20fps update
        return () => clearInterval(interval);
      }
    }
  }, [clip.isAnimated, gifCanvas, gifLoaded, isPlaying, clipTime]);

  return (
    <>
      <div
        ref={elementRef}
        className={cn(
          "absolute cursor-move transition-shadow duration-100 select-none pointer-events-auto",
          isSelected && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent",
          "absolute cursor-move transition-shadow duration-100 select-none pointer-events-auto",
          isSelected && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent",
          dragMode && "z-[50]" // Using direct value as we can't easily interpolate dynamic class if using Tailwind's arbitrary values, but we could use style. Let's use style for z-index to be safe via constants? Or just mapped class. 
          // The constants use 50. Tailwind usually has z-50.
          // Let's stick with z-50 class if constant is 50, otherwise inline style.
        )}
        style={{
          zIndex: dragMode ? Z_INDEX.PREVIEW.DRAGGING : zIndex,
          left: `${visualX}%`,
          top: `${visualY}%`,
          width: 'max-content', // Prevent shrink-to-fit when positioned outside container
          transform: `translate(-50%, -50%) scale(${visualScale}) rotate(${visualRotation}deg)`,
          opacity: animated.opacity,
        }}
        onMouseDown={handleMoveStart}
        onContextMenu={handleContextMenu}
      >
        {/* Image content */}
        {clip.isAnimated && gifDataUrl ? (
          <img
            src={gifDataUrl}
            alt=""
            className="object-contain pointer-events-none block max-w-[300px] max-h-[300px]"
            draggable={false}
          />
        ) : (
          <img
            src={clip.assetUrl}
            alt=""
            className="object-contain pointer-events-none block max-w-[300px] max-h-[300px]"
            draggable={false}
          />
        )}

        {/* Selection handles - only show when selected */}
        {isSelected && (
          <>
            {/* Corner handles for scaling */}
            <div
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full cursor-nwse-resize hover:bg-cyan-100"
              onMouseDown={handleScaleStart}
            />
            <div
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full cursor-nesw-resize hover:bg-cyan-100"
              onMouseDown={handleScaleStart}
            />
            <div
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full cursor-nesw-resize hover:bg-cyan-100"
              onMouseDown={handleScaleStart}
            />
            <div
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-400 rounded-full cursor-nwse-resize hover:bg-cyan-100"
              onMouseDown={handleScaleStart}
            />

            {/* Rotation handle */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div
                className="w-5 h-5 bg-white border-2 border-cyan-400 rounded-full cursor-grab hover:bg-cyan-100 flex items-center justify-center"
                onMouseDown={handleRotateStart}
              >
                <RotateCw className="w-3 h-3 text-cyan-600" />
              </div>
              <div className="w-0.5 h-4 bg-cyan-400" />
            </div>
          </>
        )}
      </div>

      {/* Context Menu - Rendered in Portal to avoid clipping/transform issues */}
      {contextMenu && createPortal(
        <div
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            zIndex: Z_INDEX.PREVIEW.CONTEXT_MENU 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-sm text-left text-white hover:bg-zinc-700 flex items-center gap-2"
            onClick={handleFitToScreen}
          >
            <Maximize2 className="w-4 h-4" />
            Fit to Screen
          </button>
          <div className="h-px bg-zinc-700 my-1" />
          <button
            className="w-full px-3 py-2 text-sm text-left text-white hover:bg-zinc-700 flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
          >
            <ArrowUpToLine className="w-4 h-4" />
            Bring to Front
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left text-white hover:bg-zinc-700 flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
          >
            <ArrowDownToLine className="w-4 h-4" />
            Send to Back
          </button>
          <div className="h-px bg-zinc-700 my-1" />
          <button
            className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-zinc-700 flex items-center gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
