import { useAtom } from "jotai";
import { newTrackDropTargetAtom, collisionDetectedAtom } from "./SnapGuide";

interface NewTrackIndicatorProps {
  contentWidth: number;
  contentHeight: number; // Used for "bottom" positioning
}

export function NewTrackIndicator({ contentWidth, contentHeight }: NewTrackIndicatorProps) {
  const [target] = useAtom(newTrackDropTargetAtom);
  const [isCollision] = useAtom(collisionDetectedAtom);

  if (!target) return null;

  const height = 60; // Default track height
  const top = target === "top" ? 0 : contentHeight;

  // Collision-triggered: amber/warning styling
  // Normal new track: default zinc styling
  const borderColor = isCollision ? "border-amber-500" : "border-zinc-500";
  const bgColor = isCollision ? "bg-amber-900/30" : "bg-zinc-800/50";
  const badgeBg = isCollision ? "bg-amber-600" : "bg-zinc-700";
  const badgeText = isCollision ? "text-amber-100" : "text-zinc-200";

  const message = isCollision
    ? "⚠️ Overlapping – Will Create New Track"
    : target === "top"
      ? "Create Track Above"
      : "Create Track Below";

  return (
    <div
      className={`absolute left-0 z-30 flex items-center justify-center border-2 border-dashed ${borderColor} ${bgColor} backdrop-blur-sm transition-all`}
      style={{
        width: contentWidth,
        height,
        top,
      }}
    >
      <div className={`flex items-center gap-2 rounded-full ${badgeBg} px-4 py-2 text-sm font-medium ${badgeText} shadow-md`}>
        {!isCollision && <PlusIcon className="h-4 w-4" />}
        {message}
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
