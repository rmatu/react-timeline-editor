import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TimelineViewportProps {
  children: ReactNode;
  contentWidth: number;
  contentHeight: number;
  scrollX: number;
  scrollY: number;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const TimelineViewport = forwardRef<HTMLDivElement, TimelineViewportProps>(
  function TimelineViewport(
    {
      children,
      contentWidth,
      contentHeight: _contentHeight,
      scrollX,
      scrollY,
      onClick,
      className,
    },
    ref
  ) {
    void _contentHeight; // Content height managed by children
    return (
      <div
        ref={ref}
        className={cn(
          "timeline-viewport relative flex-1 overflow-hidden bg-zinc-900",
          className
        )}
        onClick={onClick}
        style={{ touchAction: "none" }}
      >
        {/* Content container with transform for virtual scrolling */}
        <div
          className="relative"
          style={{
            width: contentWidth,
            minHeight: "100%",
            transform: `translate(-${scrollX}px, -${scrollY}px)`,
          }}
        >
          {children}
        </div>

        {/* Grid background pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "50px 60px",
            backgroundPosition: `-${scrollX % 50}px -${scrollY % 60}px`,
          }}
        />
      </div>
    );
  }
);
