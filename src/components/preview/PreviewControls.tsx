import { useTimelineStore } from "@/stores/timelineStore";
import { usePlayhead } from "@/hooks/usePlayhead";
import { useZoom } from "@/hooks/useZoom";
import { formatTimecode } from "@/utils/time";
import { RESOLUTION_PRESETS } from "@/constants/timeline.constants";
import { cn } from "@/lib/utils";

interface PreviewControlsProps {
  className?: string;
}

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

      {/* Timecode Display */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-white">{formatTimecode(currentTime, fps)}</span>
        <span className="text-zinc-500">/</span>
        <span className="text-zinc-400">{formatTimecode(totalDuration, fps)}</span>
      </div>

      {/* Aspect Ratio Selector */}
      <div className="flex items-center">
        <select
          className="bg-transparent text-xs text-zinc-400 focus:outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-2 text-right"
          value={Object.entries(RESOLUTION_PRESETS).find(([_, r]) => r.width === resolution.width && r.height === resolution.height)?.[0] || ""}
          onChange={(e) => {
            const preset = RESOLUTION_PRESETS[e.target.value as keyof typeof RESOLUTION_PRESETS];
            if (preset) {
              setResolution(preset.width, preset.height);
            }
          }}
          title="Aspect Ratio"
        >
          {Object.entries(RESOLUTION_PRESETS).map(([key, preset]) => (
            <option key={key} value={key} className="bg-zinc-800">
              {preset.label}
            </option>
          ))}
        </select>
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
