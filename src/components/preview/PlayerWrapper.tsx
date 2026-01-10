import { useRef, useEffect, useState, useMemo, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Resolution } from "@/types";
import { useTimelineStore } from "@/stores/timelineStore";

interface PlayerWrapperProps {
  resolution: Resolution;
  children: (props: {
    width: number;
    height: number;
    playerRef: React.RefObject<HTMLDivElement>;
  }) => ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function PlayerWrapper({
  resolution,
  children,
  className,
  onClick,
}: PlayerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  
  // Pan state for moving the canvas
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  
  // Zoom state
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  
  // Get tool mode from store - only allow free panning in "hand" mode
  const toolMode = useTimelineStore((s) => s.toolMode);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate optimal player dimensions to contain within parent while maintaining aspect ratio
  const playerStyle = useMemo(() => {
    if (containerDimensions.width === 0 || containerDimensions.height === 0) {
      return { width: "100%", height: "100%" }; // Fallback
    }

    const { width: containerW, height: containerH } = containerDimensions;
    const targetAspect = resolution.width / resolution.height;
    const containerAspect = containerW / containerH;

    let width, height;

    if (containerAspect > targetAspect) {
      // Container is wider than target -> Constrain by height
      height = containerH;
      width = height * targetAspect;
    } else {
      // Container is taller than target -> Constrain by width
      width = containerW;
      height = width / targetAspect;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [containerDimensions, resolution]);

  // Handle mouse down for panning - works on the background area
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button always works
    const isMiddleButton = e.button === 1;
    // Alt+click always works
    const isAltClick = e.button === 0 && e.altKey;
    // Background click only works in "hand" mode
    const isBackgroundClick = e.target === e.currentTarget;
    const canPanWithBackground = isBackgroundClick && toolMode === "hand";
    
    if (isMiddleButton || isAltClick || canPanWithBackground) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: panOffset.x,
        offsetY: panOffset.y,
      };
    }
  }, [panOffset, toolMode]);

  // Handle mouse move for panning
  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.offsetX + dx,
        y: panStartRef.current.offsetY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  // Reset pan and zoom to center
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Double-click on empty space resets pan and zoom
    if (e.target === containerRef.current || e.target === e.currentTarget) {
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
    }
  }, []);

  // Handle wheel for zooming (Ctrl/Cmd + scroll)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/Cmd + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = 1 - e.deltaY * 0.002;
      setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * zoomFactor)));
    }
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative flex items-center justify-center w-full h-full min-h-0 overflow-hidden",
        isPanning ? "cursor-grabbing" : toolMode === "hand" ? "cursor-grab" : "cursor-default",
        className
      )}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      {/* Wrapper for player + overlay - positioned relative so overlay can extend beyond player */}
      <div 
        className="relative transition-transform duration-75 pointer-events-none" 
        style={{
          ...playerStyle,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        }}
      >
        <div className="pointer-events-auto w-full h-full">
          {children({ 
            width: parseFloat(playerStyle.width), 
            height: parseFloat(playerStyle.height),
            playerRef 
          })}
        </div>
      </div>

      {/* Pan/Zoom controls - shows when offset or zoom is non-default */}
      {(panOffset.x !== 0 || panOffset.y !== 0 || zoom !== 1) && (
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <button
            onClick={() => {
              setPanOffset({ x: 0, y: 0 });
              setZoom(1);
            }}
            className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded border border-zinc-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reset View
            {zoom !== 1 && <span className="text-zinc-400">({Math.round(zoom * 100)}%)</span>}
          </button>
        </div>
      )}
    </div>
  );
}
