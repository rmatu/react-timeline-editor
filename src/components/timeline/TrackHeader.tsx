import { useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { cn } from "@/lib/utils";
import { TRACK_COLORS } from "@/constants/timeline.constants";
import type { Track } from "@/schemas";

interface TrackHeaderProps {
  track: Track;
}

export function TrackHeader({ track }: TrackHeaderProps) {
  const { selectedTrackId, selectTrack, updateTrack } = useTimelineStore();
  const isSelected = selectedTrackId === track.id;

  const handleClick = useCallback(() => {
    selectTrack(track.id);
  }, [track.id, selectTrack]);

  const handleToggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateTrack(track.id, { muted: !track.muted });
    },
    [track.id, track.muted, updateTrack]
  );

  const handleToggleVisible = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateTrack(track.id, { visible: !track.visible });
    },
    [track.id, track.visible, updateTrack]
  );

  const handleToggleLock = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateTrack(track.id, { locked: !track.locked });
    },
    [track.id, track.locked, updateTrack]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-zinc-700 px-2 transition-colors",
        isSelected ? "bg-zinc-700" : "bg-zinc-800 hover:bg-zinc-750"
      )}
      style={{ height: track.height }}
      onClick={handleClick}
    >
      {/* Track type indicator */}
      <div
        className="h-3 w-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: track.color || TRACK_COLORS[track.type] }}
      />

      {/* Track name */}
      <span className="flex-1 truncate text-sm text-zinc-200">{track.name}</span>

      {/* Track controls */}
      <div className="flex items-center gap-1">
        {/* Visibility toggle */}
        <button
          className={cn(
            "rounded p-1 text-xs transition-colors",
            track.visible
              ? "text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
              : "bg-zinc-600 text-zinc-500"
          )}
          onClick={handleToggleVisible}
          title={track.visible ? "Hide track" : "Show track"}
        >
          <EyeIcon className="h-3 w-3" visible={track.visible} />
        </button>

        {/* Mute toggle (for audio/video tracks) */}
        {(track.type === "audio" || track.type === "video") && (
          <button
            className={cn(
              "rounded p-1 text-xs transition-colors",
              track.muted
                ? "bg-red-900/50 text-red-400"
                : "text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
            )}
            onClick={handleToggleMute}
            title={track.muted ? "Unmute" : "Mute"}
          >
            <MuteIcon className="h-3 w-3" muted={track.muted} />
          </button>
        )}

        {/* Lock toggle */}
        <button
          className={cn(
            "rounded p-1 text-xs transition-colors",
            track.locked
              ? "bg-yellow-900/50 text-yellow-400"
              : "text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
          )}
          onClick={handleToggleLock}
          title={track.locked ? "Unlock" : "Lock"}
        >
          <LockIcon className="h-3 w-3" locked={track.locked} />
        </button>
      </div>
    </div>
  );
}

// Icon components
function EyeIcon({ className, visible }: { className?: string; visible: boolean }) {
  if (visible) {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3.5C3 3.5 0 8 0 8s3 4.5 8 4.5 8-4.5 8-4.5-3-4.5-8-4.5zm0 7.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
        <circle cx="8" cy="8" r="1.5" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 1.5l-13 13M8 3.5C3 3.5 0 8 0 8s1.5 2.25 4 3.5M8 12.5c5 0 8-4.5 8-4.5s-1.5-2.25-4-3.5" stroke="currentColor" fill="none" />
    </svg>
  );
}

function MuteIcon({ className, muted }: { className?: string; muted: boolean }) {
  if (muted) {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2L4 6H1v4h3l4 4V2zM14.5 5.5l-5 5M14.5 10.5l-5-5" stroke="currentColor" fill="none" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2L4 6H1v4h3l4 4V2z" />
      <path d="M11 5.5c1 1 1 4 0 5M13 3.5c2 2 2 7 0 9" stroke="currentColor" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

function LockIcon({ className, locked }: { className?: string; locked: boolean }) {
  if (locked) {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="currentColor">
        <rect x="2" y="7" width="12" height="8" rx="1" />
        <path d="M4 7V5a4 4 0 1 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="7" width="12" height="8" rx="1" />
      <path d="M4 7V5a4 4 0 0 1 8 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
