import { useRef, useEffect, useState, useMemo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Resolution } from "@/types";

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

  return (
    <div 
      ref={containerRef} 
      className={cn("flex items-center justify-center w-full h-full min-h-0", className)}
      onClick={onClick}
    >
      {/* Wrapper for player + overlay - positioned relative so overlay can extend beyond player */}
      <div className="relative" style={playerStyle}>
        {children({ 
          width: parseFloat(playerStyle.width), 
          height: parseFloat(playerStyle.height),
          playerRef 
        })}
      </div>
    </div>
  );
}
