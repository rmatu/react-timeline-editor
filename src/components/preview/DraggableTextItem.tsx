import { useRef, useState, useCallback, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TextClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";
import { cn } from "@/lib/utils";
import { RotateCw } from "lucide-react";

interface DraggableTextItemProps {
  clip: TextClip;
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

type DragMode = "move" | "scale" | "rotate" | "width" | null;

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startPosX: number;
  startPosY: number;
  startScale: number;
  startRotation: number;
  startWidth: number;
  centerX: number;
  centerY: number;
  // Cached container dimensions at drag start
  containerWidth: number;
  containerHeight: number;
}

/**
 * A text item that can be selected, dragged, scaled, and rotated within the preview.
 */
export function DraggableTextItem({ clip, currentTime, containerRef }: DraggableTextItemProps) {
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const selectClip = useTimelineStore((state) => state.selectClip);
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);

  const isSelected = selectedClipIds.includes(clip.id);
  const elementRef = useRef<HTMLDivElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0, scale: 0, rotation: 0, width: 0 });
  
  const dragStartRef = useRef<DragState>({
    mode: null,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    startScale: 1,
    startRotation: 0,
    startWidth: 0,
    centerX: 0,
    centerY: 0,
    containerWidth: 0,
    containerHeight: 0,
  });

  // Get animated properties at current time
  const animated = getAnimatedPropertiesAtTime(clip, currentTime);

  // Start moving - use animated position to prevent jumping when keyframes exist
  const baseScale = animated.scale;
  const baseRotation = animated.rotation;

  // Start moving - use animated position to prevent jumping when keyframes exist
  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id, e.shiftKey);

    // Cache container dimensions at drag start
    const container = containerRef.current;
    const containerRect = container?.getBoundingClientRect();

    setDragMode("move");
    dragStartRef.current = {
      ...dragStartRef.current,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      // Use animated position (current visual position) to prevent jump when keyframes exist
      startPosX: animated.position.x,
      startPosY: animated.position.y,
      containerWidth: containerRect?.width ?? 0,
      containerHeight: containerRect?.height ?? 0,
    };
  }, [clip.id, animated.position.x, animated.position.y, selectClip, containerRef]);

  // Start scaling (from corner handles)
  const handleScaleStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const element = elementRef.current;
    if (!element) return;
    const elementRect = element.getBoundingClientRect();
    
    // Calculate center of element in screen coordinates
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
  }, [baseScale, containerRef]);

  // Start rotating (from rotation handle)
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

  // Start width resize (from edge handles)
  const handleWidthStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Use the inner text content element for accurate width measurement
    // This avoids issues with rotation affecting getBoundingClientRect
    const textElement = textContentRef.current;
    if (!textElement) return;

    // scrollWidth gives the actual content width, unaffected by parent transforms
    // If maxWidth is already set, use it; otherwise use the natural content width
    const contentWidth = textElement.scrollWidth;
    const currentWidth = clip.maxWidth ?? contentWidth;

    setDragMode("width");
    dragStartRef.current = {
      ...dragStartRef.current,
      mode: "width",
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentWidth,
    };
  }, [clip.maxWidth]);

  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      
      const { mode, startX, startY, centerX, centerY } = dragStartRef.current;

      if (mode === "move") {
        // Use cached container dimensions instead of recalculating
        const { containerWidth, containerHeight } = dragStartRef.current;
        if (containerWidth === 0 || containerHeight === 0) return;
        
        const deltaX = ((e.clientX - startX) / containerWidth) * 100;
        const deltaY = ((e.clientY - startY) / containerHeight) * 100;
        setDragDelta({ x: deltaX, y: deltaY, scale: 0, rotation: 0, width: 0 });
      } 
      else if (mode === "scale") {
        // Calculate scale based on distance from center
        const startDist = Math.sqrt(Math.pow(startX - centerX, 2) + Math.pow(startY - centerY, 2));
        const currentDist = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));
        const scaleDelta = (currentDist / startDist) - 1;
        setDragDelta({ x: 0, y: 0, scale: scaleDelta, rotation: 0, width: 0 });
      }
      else if (mode === "rotate") {
        // Calculate rotation angle from center
        const startAngle = Math.atan2(startY - centerY, startX - centerX);
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const rotationDelta = ((currentAngle - startAngle) * 180) / Math.PI;
        setDragDelta({ x: 0, y: 0, scale: 0, rotation: rotationDelta, width: 0 });
      }
      else if (mode === "width") {
        // Calculate width change based on horizontal mouse movement
        const widthDelta = e.clientX - startX;
        setDragDelta({ x: 0, y: 0, scale: 0, rotation: 0, width: widthDelta });
      }
    };

    const handleMouseUp = () => {
      const { mode, startPosX, startPosY, startScale, startRotation } = dragStartRef.current;

      // Helper to check if keyframes exist for a property on this clip
      const hasKeyframesFor = (property: string) =>
        clip.keyframes?.some(kf => kf.property === property) ?? false;

      // Use minimum thresholds to prevent accidental changes from micro-movements
      const MIN_MOVE_THRESHOLD = 0.5; // 0.5% of container size
      const MIN_WIDTH_THRESHOLD = 3; // 3 pixels

      if (mode === "move" && (Math.abs(dragDelta.x) > MIN_MOVE_THRESHOLD || Math.abs(dragDelta.y) > MIN_MOVE_THRESHOLD)) {
        saveToHistory();
        // Allow free positioning - no clamping to 0-100% so text can reach edges
        const newX = startPosX + dragDelta.x;
        const newY = startPosY + dragDelta.y;

        // Position is always stored on clip directly (not animated via keyframes typically)
        updateClip(clip.id, { position: { x: newX, y: newY } });
      } else if (mode === "scale" && dragDelta.scale !== 0) {
        saveToHistory();
        const newScale = Math.max(0.1, Math.min(5, startScale * (1 + dragDelta.scale)));

        if (hasKeyframesFor("scale")) {
          // If keyframes exist, update/add keyframe at current time
          useTimelineStore.getState().addKeyframeAtCurrentTime(clip.id, "scale", newScale);
        } else {
          // No keyframes - update base clip property
          updateClip(clip.id, { scale: newScale });
        }
      } else if (mode === "rotate" && dragDelta.rotation !== 0) {
        saveToHistory();
        const newRotation = startRotation + dragDelta.rotation;

        if (hasKeyframesFor("rotation")) {
          // If keyframes exist, update/add keyframe at current time
          useTimelineStore.getState().addKeyframeAtCurrentTime(clip.id, "rotation", newRotation);
        } else {
          // No keyframes - update base clip property
          updateClip(clip.id, { rotation: newRotation });
        }
      } else if (mode === "width" && Math.abs(dragDelta.width) > MIN_WIDTH_THRESHOLD) {
        saveToHistory();
        const { startWidth } = dragStartRef.current;
        const newWidth = Math.max(50, startWidth + dragDelta.width);
        updateClip(clip.id, { maxWidth: newWidth });
      }

      setDragMode(null);
      setDragDelta({ x: 0, y: 0, scale: 0, rotation: 0, width: 0 });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragMode, dragDelta, clip.id, updateClip, saveToHistory, containerRef]);

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

  return (
    <div
      ref={elementRef}
      className={cn(
        "absolute cursor-move transition-shadow duration-100 select-none pointer-events-auto",
        isSelected && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent",
        dragMode && "z-50"
      )}
      style={{
        left: `${visualX}%`,
        top: `${visualY}%`,
        transform: `translate(-50%, -50%) scale(${visualScale}) rotate(${visualRotation}deg)`,
        opacity: animated.opacity,
        // Prevent width collapsing when positioned near container edges
        width: clip.maxWidth ? `${clip.maxWidth}px` : 'max-content',
      }}
      onMouseDown={handleMoveStart}
    >
      {/* Text content */}
      <div
        ref={textContentRef}
        style={{
          fontFamily: clip.fontFamily,
          fontSize: `${animated.fontSize ?? clip.fontSize}px`,
          fontWeight: clip.fontWeight,
          color: animated.color ?? clip.color,
          backgroundColor: clip.backgroundColor || "transparent",
          textAlign: clip.textAlign,
          padding: clip.backgroundColor ? "4px 8px" : 0,
          borderRadius: clip.backgroundColor ? 4 : 0,
          // Text width constraint priority:
          // 1. During width drag - use drag delta
          // 2. Explicit clip.maxWidth set by user
          // 3. Fall back to 90% of container width (for narrow aspect ratios)
          maxWidth: dragMode === "width" && Math.abs(dragDelta.width) > 3
            ? `${Math.max(50, dragStartRef.current.startWidth + dragDelta.width)}px`
            : clip.maxWidth 
              ? `${clip.maxWidth}px` 
              : undefined,
          // Word wrap only if we have a constraint (drag or specific maxWidth)
          whiteSpace: (clip.maxWidth || (dragMode === "width" && Math.abs(dragDelta.width) > 3)) 
            ? "normal" 
            : "nowrap",
          wordBreak: (clip.maxWidth || (dragMode === "width" && Math.abs(dragDelta.width) > 3)) 
            ? "break-word" 
            : undefined,
          textShadow: !clip.backgroundColor ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {clip.content}
      </div>

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

          {/* Rotation handle - positioned above the element */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div 
              className="w-5 h-5 bg-white border-2 border-cyan-400 rounded-full cursor-grab hover:bg-cyan-100 flex items-center justify-center"
              onMouseDown={handleRotateStart}
            >
              <RotateCw className="w-3 h-3 text-cyan-600" />
            </div>
            {/* Connecting line */}
            <div className="w-0.5 h-4 bg-cyan-400" />
          </div>

          {/* Edge handles for width resize */}
          <div 
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-cyan-400 rounded-full cursor-ew-resize hover:bg-cyan-100" 
            onMouseDown={handleWidthStart}
          />
          <div 
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-cyan-400 rounded-full cursor-ew-resize hover:bg-cyan-100" 
            onMouseDown={handleWidthStart}
          />
        </>
      )}
    </div>
  );
}

