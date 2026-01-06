import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  children: React.ReactNode;
  onResize?: (height: number) => void;
}

export function ResizablePanel({
  minHeight = 100,
  maxHeight = 500,
  defaultHeight = 224, // h-56 = 14rem = 224px
  children,
  onResize,
}: ResizablePanelProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startY.current = e.clientY;
      startHeight.current = height;
    },
    [height]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Moving up increases height (negative delta)
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(
        maxHeight,
        Math.max(minHeight, startHeight.current + delta)
      );
      setHeight(newHeight);
      onResize?.(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minHeight, maxHeight, onResize]);

  return (
    <div ref={containerRef} className="relative flex flex-col">
      {/* Resize handle */}
      <div
        className={cn(
          "flex h-2 cursor-ns-resize items-center justify-center transition-colors",
          "hover:bg-zinc-700/50",
          isDragging && "bg-blue-500/30"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="h-1 w-12 rounded-full bg-zinc-600" />
      </div>

      {/* Content */}
      <div
        className="overflow-hidden"
        style={{ height }}
      >
        {children}
      </div>
    </div>
  );
}
