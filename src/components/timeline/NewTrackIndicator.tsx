import { useAtom } from "jotai";
import { newTrackDropTargetAtom } from "./SnapGuide";

interface NewTrackIndicatorProps {
  contentWidth: number;
  contentHeight: number; // Used for "bottom" positioning
}

export function NewTrackIndicator({ contentWidth, contentHeight }: NewTrackIndicatorProps) {
  const [target] = useAtom(newTrackDropTargetAtom);

  if (!target) return null;

  const height = 60; // Default track height
  const top = target === "top" ? 0 : contentHeight;

  return (
    <div
      className="absolute left-0 z-30 flex items-center justify-center border-2 border-dashed border-zinc-500 bg-zinc-800/50 backdrop-blur-sm transition-all"
      style={{
        width: contentWidth,
        height,
        top,
      }}
    >
      <div className="flex items-center gap-2 rounded-full bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 shadow-md">
        <PlusIcon className="h-4 w-4" />
        {target === "top" ? "Create Track Above" : "Create Track Below"}
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
