import { useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { Clip as ClipComponent } from "./Clip";
import { cn } from "@/lib/utils";
import { isClipVisible } from "@/utils/geometry";
import { TRACK_COLORS } from "@/constants/timeline.constants";
import type { Track as TrackType, Clip } from "@/schemas";

interface TrackProps {
  track: TrackType;
  clips: Clip[];
  zoomLevel: number;
  scrollX: number;
  selectedClipIds: string[];
}

// Removed memo temporarily to fix selection re-rendering issue
export function Track({
  track,
  clips,
  zoomLevel,
  scrollX,
  selectedClipIds,
}: TrackProps) {
  const { selectedTrackId, selectTrack, selectClip } = useTimelineStore();
  const isSelected = selectedTrackId === track.id;

  // Filter to only visible clips for performance
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 2000;
  const visibleClips = clips.filter((clip) =>
    isClipVisible(clip, scrollX, viewportWidth, zoomLevel)
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      // Only select track if clicking on empty space
      if ((e.target as HTMLElement).closest(".clip")) return;
      selectTrack(track.id);
    },
    [track.id, selectTrack]
  );

  const handleClipSelect = useCallback(
    (clipId: string, multi: boolean) => {
      selectClip(clipId, multi);
    },
    [selectClip]
  );

  return (
    <div
      className={cn(
        "relative border-b border-zinc-700 transition-colors",
        isSelected ? "bg-zinc-800/50" : "bg-zinc-900",
        track.locked && "opacity-60",
        !track.visible && "opacity-30"
      )}
      style={{ height: track.height }}
      onClick={handleTrackClick}
    >
      {/* Track background with type-specific color hint */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundColor: track.color || TRACK_COLORS[track.type],
        }}
      />

      {/* Track locked overlay */}
      {track.locked && (
        <div className="absolute inset-0 z-10 cursor-not-allowed bg-zinc-900/30" />
      )}

      {/* Clips */}
      {visibleClips.map((clip) => (
        <ClipComponent
          key={clip.id}
          clip={clip}
          track={track}
          zoomLevel={zoomLevel}
          scrollX={scrollX}
          isSelected={selectedClipIds.includes(clip.id)}
          onSelect={handleClipSelect}
          disabled={track.locked}
        />
      ))}

      {/* Drop zone indicator */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 border-2 border-blue-500/30" />
      )}
    </div>
  );
}
