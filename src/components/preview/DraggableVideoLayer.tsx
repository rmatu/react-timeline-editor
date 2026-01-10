import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTimelineStore } from "@/stores/timelineStore";
import type { VideoClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";
import { cn } from "@/lib/utils";
import { RotateCw, Maximize2, Trash2, ArrowUpToLine, ArrowDownToLine } from "lucide-react";
import { Z_INDEX } from "@/constants/timeline.constants";

interface DraggableVideoLayerProps {
  clip: VideoClip;
  currentTime: number;
  isPlaying: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onTimeUpdate: (time: number) => void;
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
 * A video layer that can be selected, dragged, scaled, and rotated within the preview.
 * Calculates actual video dimensions to provide a tight selection outline.
 */
export function DraggableVideoLayer({
  clip,
  currentTime,
  isPlaying,
  containerRef,
  onTimeUpdate,
  zIndex,
}: DraggableVideoLayerProps) {
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const selectClip = useTimelineStore((state) => state.selectClip);
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);
  const removeClip = useTimelineStore((state) => state.removeClip);
  const tracks = useTimelineStore((state) => state.tracks);

  const isSelected = selectedClipIds.includes(clip.id);
  const elementRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Track intrinsic video dimensions
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  
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
  const animated = useMemo(
    () => getAnimatedPropertiesAtTime(clip, currentTime),
    [clip, currentTime]
  );

  // Check if clip is active (visible at current time)
  const isActive = currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration;
  const trackMuted = tracks.get(clip.trackId)?.muted ?? false;

  // Base values for transforms
  const baseScale = animated.scale;
  const baseRotation = animated.rotation;

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  }, []);

  // Force re-calculation when container resizes
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  // Calculate display dimensions based on container and video aspect ratio
  const displayDimensions = useMemo(() => {
    const container = containerRef.current;
    if (!container || videoDimensions.width === 0 || videoDimensions.height === 0) {
      return { width: 200, height: 150 }; // Fallback
    }

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Use containerSize in dependency array to trigger recalculation on resize
    // (even though we read from getBoundingClientRect for sync accuracy)
    void containerSize; 

    // Calculate contain-mode dimensions (like object-fit: contain)
    const videoAspect = videoDimensions.width / videoDimensions.height;
    const containerAspect = containerWidth / containerHeight;

    let width: number, height: number;

    if (containerAspect > videoAspect) {
      // Container is wider - constrain by height
      height = containerHeight;
      width = height * videoAspect;
    } else {
      // Container is taller - constrain by width
      width = containerWidth;
      height = width / videoAspect;
    }

    return { width, height };
  }, [containerRef, videoDimensions, containerSize]); // Added containerSize dependency

  // Video synchronization effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Always mute video element, audio is handled by AudioLayer
    video.muted = true;
    video.playbackRate = clip.playbackRate;

    if (isActive && isPlaying) {
      video.play().catch(() => {
        // Autoplay restrictions
      });
    } else {
      video.pause();
    }

    // Time sync
    const targetVideoTime = clip.sourceStartTime + (currentTime - clip.startTime) * clip.playbackRate;
    const timeDiff = Math.abs(video.currentTime - targetVideoTime);

    if (!isPlaying || timeDiff > 0.2) {
      if (Number.isFinite(targetVideoTime)) {
        video.currentTime = targetVideoTime;
      }
    }
  }, [isActive, isPlaying, clip, currentTime, trackMuted]);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!isActive || !isPlaying) return;
    const video = e.currentTarget;
    const timelineTime = clip.startTime + (video.currentTime - clip.sourceStartTime);
    onTimeUpdate(timelineTime);
  }, [isActive, isPlaying, clip.startTime, clip.sourceStartTime, onTimeUpdate]);

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

  // Don't render if not in range
  if (!isActive) return null;

  return (
    <>
      <div
        ref={elementRef}
        className={cn(
          "absolute cursor-move transition-shadow duration-100 select-none pointer-events-auto",
          "absolute cursor-move transition-shadow duration-100 select-none pointer-events-auto",
          isSelected && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent",
          dragMode && "z-[50]"
        )}
        style={{
          zIndex: dragMode ? Z_INDEX.PREVIEW.DRAGGING : zIndex,
          left: `${visualX}%`,
          top: `${visualY}%`,
          // Use calculated dimensions for tight outline
          width: displayDimensions.width,
          height: displayDimensions.height,
          transform: `translate(-50%, -50%) scale(${visualScale}) rotate(${visualRotation}deg)`,
          opacity: animated.opacity,
        }}
        onMouseDown={handleMoveStart}
        onContextMenu={handleContextMenu}
      >
        {/* Video element - fills the wrapper exactly */}
        <video
          ref={videoRef}
          src={clip.sourceUrl}
          className="w-full h-full rounded-lg pointer-events-none object-contain"
          preload="auto"
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        />

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

      {/* Context Menu - Rendered in Portal */}
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
