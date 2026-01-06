import { cn } from "@/lib/utils";
import { TRIM_HANDLE_WIDTH } from "@/constants/timeline.constants";

interface TrimHandleProps {
  side: "left" | "right";
  bind: ReturnType<typeof import("@use-gesture/react").useDrag>;
  canExtend: boolean;
  isActive: boolean;
}

export function TrimHandle({ side, bind, canExtend, isActive }: TrimHandleProps) {
  return (
    <div
      {...bind()}
      className={cn(
        "trim-handle absolute top-0 bottom-0 z-10 cursor-ew-resize",
        "flex items-center justify-center",
        "transition-colors duration-100",
        side === "left" ? "left-0" : "right-0",
        isActive && "bg-blue-500/30"
      )}
      style={{
        width: TRIM_HANDLE_WIDTH,
        touchAction: "none",
      }}
    >
      {/* Visual handle indicator */}
      <div
        className={cn(
          "h-8 w-1.5 rounded-full transition-colors",
          isActive ? "bg-blue-400" : "bg-white/60 hover:bg-white/80",
          !canExtend && "opacity-50"
        )}
      >
        {/* Chevron indicator showing trim direction capability */}
        <div className="flex h-full flex-col items-center justify-center gap-0.5">
          <div
            className={cn(
              "h-0 w-0 border-4 border-transparent",
              side === "left"
                ? canExtend
                  ? "border-r-current"
                  : "border-l-current opacity-30"
                : canExtend
                  ? "border-l-current"
                  : "border-r-current opacity-30"
            )}
          />
        </div>
      </div>

      {/* Extended hit area (invisible but increases touch target) */}
      <div
        className="absolute inset-y-0"
        style={{
          left: side === "left" ? -12 : "auto",
          right: side === "right" ? -12 : "auto",
          width: 24,
        }}
      />
    </div>
  );
}
