import { useState, useRef, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { usePlayhead } from "@/hooks/usePlayhead";
import { useZoom } from "@/hooks/useZoom";
import { formatTimecode } from "@/utils/time";
import { RESOLUTION_PRESETS } from "@/constants/timeline.constants";
import { cn } from "@/lib/utils";

interface PreviewControlsProps {
  className?: string;
}

const AspectRatioIcon = ({ width, height, className }: { width: number; height: number; className?: string }) => {
  // Normalize dimensions to fit in a 24x24 box
  const maxDim = 18;
  const ratio = width / height;
  let w, h;
  
  if (ratio > 1) {
    w = maxDim;
    h = maxDim / ratio;
  } else {
    h = maxDim;
    w = maxDim * ratio;
  }

  return (
    <svg className={className} 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <rect 
        x={12 - w/2} 
        y={12 - h/2} 
        width={w} 
        height={h} 
        rx="1" 
        stroke="currentColor" 
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
};

export function PreviewControls({ className }: PreviewControlsProps) {
  const { fps, totalDuration, resolution, setResolution } = useTimelineStore();
  const {
    currentTime,
    isPlaying,
    togglePlayback,
    jumpToStart,
    jumpToEnd,
    stepForward,
    stepBackward,
  } = usePlayhead();
  const { zoomIn, zoomOut, resetZoom, zoomPercentage } = useZoom();
  const { selectedClipIds, splitClip, mergeClips, saveToHistory } = useTimelineStore();

  const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);
  const ratioMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ratioMenuRef.current && !ratioMenuRef.current.contains(event.target as Node)) {
        setIsRatioMenuOpen(false);
      }
    };

    if (isRatioMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRatioMenuOpen]);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg bg-zinc-800 px-4 py-2",
        className
      )}
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {/* Jump to start */}
        <button
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          onClick={jumpToStart}
          title="Jump to start"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Step backward */}
        <button
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          onClick={() => stepBackward(fps)}
          title="Previous frame"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm10 0v12l-8-6z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          className="rounded-full bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500"
          onClick={togglePlayback}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Step forward */}
        <button
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          onClick={() => stepForward(fps)}
          title="Next frame"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 6h2v12h-2zM8 6l8 6-8 6z" />
          </svg>
        </button>

        {/* Jump to end */}
        <button
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          onClick={jumpToEnd}
          title="Jump to end"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z" />
          </svg>
        </button>
      </div>

      {/* Editing Tools */}
      <div className="flex items-center gap-1 border-l border-zinc-700 pl-4">
        {/* Split */}
        <button
          className={cn(
            "rounded p-1.5 transition-colors",
            selectedClipIds.length > 0
              ? "text-zinc-400 hover:bg-zinc-700 hover:text-white"
              : "text-zinc-600 cursor-not-allowed"
          )}
          onClick={() => {
            if (selectedClipIds.length > 0) {
              saveToHistory();
              for (const clipId of selectedClipIds) {
                splitClip(clipId, currentTime);
              }
            }
          }}
          disabled={selectedClipIds.length === 0}
          title="Split clip at playhead (S)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4l4 4-4 4M18 4l-4 4 4 4" />
            <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
          </svg>
        </button>

        {/* Merge */}
        <button
          className={cn(
            "rounded p-1.5 transition-colors",
            selectedClipIds.length >= 2
              ? "text-zinc-400 hover:bg-zinc-700 hover:text-white"
              : "text-zinc-600 cursor-not-allowed"
          )}
          onClick={() => {
            if (selectedClipIds.length >= 2) {
              saveToHistory();
              mergeClips(selectedClipIds);
            }
          }}
          disabled={selectedClipIds.length < 2}
          title="Merge selected clips (M)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 4l-4 4 4 4M6 4l4 4-4 4" />
            <line x1="8" y1="8" x2="16" y2="8" />
          </svg>
        </button>
      </div>

      {/* Timecode Display */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-white">{formatTimecode(currentTime, fps)}</span>
        <span className="text-zinc-500">/</span>
        <span className="text-zinc-400">{formatTimecode(totalDuration, fps)}</span>
      </div>

      {/* Aspect Ratio Selector */}
      <div className="relative" ref={ratioMenuRef}>
        <button
          className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
          onClick={() => setIsRatioMenuOpen(!isRatioMenuOpen)}
          title="Aspect Ratio"
        >
          <AspectRatioIcon 
            width={resolution.width} 
            height={resolution.height} 
            className="w-4 h-4"
          />
          <span>
            {Object.values(RESOLUTION_PRESETS).find(
              (r) => r.width === resolution.width && r.height === resolution.height
            )?.label || "Custom"}
          </span>
          <svg className="w-3 h-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isRatioMenuOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl z-50 overflow-hidden py-1">
            {Object.entries(RESOLUTION_PRESETS).map(([key, preset]) => {
              const isActive = preset.width === resolution.width && preset.height === resolution.height;
              return (
                <button
                  key={key}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-xs text-left transition-colors",
                    isActive 
                      ? "bg-blue-600/10 text-blue-400" 
                      : "text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  )}
                  onClick={() => {
                    setResolution(preset.width, preset.height);
                    setIsRatioMenuOpen(false);
                  }}
                >
                  <AspectRatioIcon 
                    width={preset.width} 
                    height={preset.height} 
                    className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-zinc-500")}
                  />
                  <div>
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-[10px] opacity-70">{preset.width}x{preset.height}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2 border-l border-zinc-700 pl-4">
        <button
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          onClick={() => zoomOut()}
          title="Zoom out (-)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z" />
          </svg>
        </button>

        <button
          className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white min-w-[3rem] text-center"
          onClick={resetZoom}
          title="Reset zoom"
        >
          {zoomPercentage}%
        </button>

        <button
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          onClick={() => zoomIn()}
          title="Zoom in (+)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM12 10h-2v2H9v-2H7V9h2V7h1v2h2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
