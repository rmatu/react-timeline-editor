import { useCallback, useState, useRef, useEffect } from "react";
import { useDrag } from "@use-gesture/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TRACK_COLORS } from "@/constants/timeline.constants";
import type { Track } from "@/schemas";

interface TrackHeaderProps {
  track: Track;
  sortedTracks: Track[];
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function TrackHeader({ track, sortedTracks, onDragStart, onDragEnd }: TrackHeaderProps) {
  const { selectedTrackId, selectTrack, updateTrack, removeTrack, saveToHistory, undo, reorderTracks } = useTimelineStore();
  const isSelected = selectedTrackId === track.id;

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track reorder drag state
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);
  const dragStateRef = useRef<{
    initialOrder: string[];
    trackIndex: number;
    originalIndex: number;
  } | null>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    selectTrack(track.id);
  }, [track.id, selectTrack]);

  const handleNameDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedName(track.name);
  }, [track.name]);

  const handleNameSubmit = useCallback(() => {
    setIsEditing(false);
    if (editedName.trim() && editedName !== track.name) {
      updateTrack(track.id, { name: editedName.trim() });
    } else {
      setEditedName(track.name); // Revert if empty
    }
  }, [editedName, track.name, track.id, updateTrack]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditedName(track.name);
    }
  }, [handleNameSubmit, track.name]);

  // Resize handler
  const bindResize = useDrag(({ delta: [, dy], first, last }) => {
    if (first) document.body.style.cursor = "row-resize";
    if (last) document.body.style.cursor = "";

    const newHeight = Math.max(40, track.height + dy);
    updateTrack(track.id, { height: newHeight });
  });

  // Track reorder drag handler
  const bindTrackDrag = useDrag(
    ({ movement: [, my], first, last, event }) => {
      event?.stopPropagation();

      if (first) {
        const originalIndex = sortedTracks.findIndex((t) => t.id === track.id);
        dragStateRef.current = {
          initialOrder: sortedTracks.map((t) => t.id),
          trackIndex: originalIndex,
          originalIndex,
        };
        setIsDraggingTrack(true);
        onDragStart?.();
        document.body.style.cursor = "grabbing";
      }

      if (dragStateRef.current && !last) {
        const { initialOrder, originalIndex } = dragStateRef.current;

        // Calculate which track position we're over
        let accumulatedHeight = 0;
        let newIndex = originalIndex;

        // Calculate original track's starting position
        let originalTop = 0;
        for (let i = 0; i < originalIndex; i++) {
          originalTop += sortedTracks[i].height;
        }

        // Calculate current drag position (center of dragged track)
        const dragY = originalTop + my + track.height / 2;

        // Find which position we should be at
        for (let i = 0; i < sortedTracks.length; i++) {
          const trackCenter = accumulatedHeight + sortedTracks[i].height / 2;
          if (dragY < trackCenter) {
            newIndex = i;
            break;
          }
          accumulatedHeight += sortedTracks[i].height;
          newIndex = i;
        }

        // Clamp to valid range
        newIndex = Math.max(0, Math.min(sortedTracks.length - 1, newIndex));

        if (newIndex !== dragStateRef.current.trackIndex) {
          // Create reordered array
          const newOrder = [...initialOrder];
          const [movedId] = newOrder.splice(originalIndex, 1);
          newOrder.splice(newIndex, 0, movedId);

          // Update immediately for visual feedback
          reorderTracks(newOrder);
          dragStateRef.current.trackIndex = newIndex;
        }
      }

      if (last) {
        setIsDraggingTrack(false);
        onDragEnd?.();
        document.body.style.cursor = "";

        if (dragStateRef.current) {
          const { originalIndex, trackIndex } = dragStateRef.current;
          if (trackIndex !== originalIndex) {
            // Save to history for undo
            // Note: reorderTracks was already called during drag
            saveToHistory();
          }
        }
        dragStateRef.current = null;
      }
    },
    {
      filterTaps: true,
      pointer: { capture: false },
    }
  );

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

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Save state before deleting for undo
      saveToHistory();
      removeTrack(track.id);

      toast.success("Track deleted", {
        description: `${track.name} has been removed.`,
        action: {
          label: "Undo",
          onClick: () => undo(),
        },
      });
    },
    [track.id, track.name, removeTrack, saveToHistory, undo]
  );

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 border-b border-zinc-700 px-2 transition-colors",
        isSelected ? "bg-zinc-700" : "bg-zinc-800 hover:bg-zinc-750",
        isDraggingTrack && "bg-zinc-600 shadow-lg z-50"
      )}
      style={{ height: track.height }}
      onClick={handleClick}
    >
      {/* Drag handle */}
      <div
        {...bindTrackDrag()}
        className={cn(
          "flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-zinc-600 transition-colors touch-none",
          isDraggingTrack && "cursor-grabbing bg-zinc-500"
        )}
        title="Drag to reorder track"
      >
        <GripIcon className="h-4 w-4 text-zinc-500" />
      </div>

      {/* Track type indicator */}
      <div
        className="h-3 w-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: track.color || TRACK_COLORS[track.type] }}
      />

      {/* Track name (editable) */}
      {isEditing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 bg-zinc-900 border border-zinc-600 rounded px-1 py-0.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleNameSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()} // Prevent selecting track on input click
        />
      ) : (
        <span 
          className="flex-1 truncate text-sm text-zinc-200 cursor-text select-none"
          onDoubleClick={handleNameDoubleClick}
          title="Double click to rename"
        >
          {track.name}
        </span>
      )}

      {/* Track controls */}
      <div className="absolute right-0 top-0 h-full z-10 flex items-center gap-1 pr-2 pl-2 bg-inherit opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {/* Visibility toggle - hide for audio tracks */}
        {track.type !== "audio" && (
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
        )}

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

        {/* Delete track */}
        <button
          className="rounded p-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-600 hover:text-red-400"
          onClick={handleDelete}
          title="Delete track"
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Resize Handle */}
      <div
        {...bindResize()}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize opacity-0 transition-opacity hover:bg-blue-500/50 group-hover:opacity-100 z-10"
      />
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
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M5 3.25V3H11V3.25H14.5V4.75H13.848L13.196 13.68C13.129 14.596 12.366 15.303 11.448 15.303H4.552C3.634 15.303 2.871 14.596 2.804 13.68L2.152 4.75H1.5V3.25H5ZM6.5 3H9.5V1.75H6.5V3ZM3.66 4.75L4.298 13.57C4.308 13.722 4.436 13.84 4.552 13.84H11.448C11.564 13.84 11.692 13.722 11.702 13.57L12.34 4.75H3.66Z"
        clipRule="evenodd"
      />
      <path d="M6 7H7.5V12H6V7Z" />
      <path d="M8.5 7H10V12H8.5V7Z" />
    </svg>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}
