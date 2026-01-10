import { useTimelineStore, type TimelineToolMode } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";

interface ToolModeButtonProps {
  mode: TimelineToolMode;
  currentMode: TimelineToolMode;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

function ToolModeButton({ mode, currentMode, onClick, icon, label, shortcut }: ToolModeButtonProps) {
  const isActive = mode === currentMode;
  
  return (
    <button
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive 
          ? "bg-blue-500 text-white" 
          : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
      )}
    >
      {icon}
    </button>
  );
}

/**
 * Toolbar for switching between timeline tool modes.
 * V = Select tool (for selecting and moving clips)
 * H = Hand tool (for panning the timeline)
 */
export function ToolModeToolbar() {
  const toolMode = useTimelineStore((s) => s.toolMode);
  const setToolMode = useTimelineStore((s) => s.setToolMode);

  return (
    <div className="flex items-center gap-0.5 p-1 bg-zinc-800 rounded border border-zinc-700">
      <ToolModeButton
        mode="select"
        currentMode={toolMode}
        onClick={() => setToolMode("select")}
        label="Select"
        shortcut="V"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Cursor arrow icon */}
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        }
      />
      <ToolModeButton
        mode="hand"
        currentMode={toolMode}
        onClick={() => setToolMode("hand")}
        label="Hand"
        shortcut="H"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Hand icon */}
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        }
      />
    </div>
  );
}
