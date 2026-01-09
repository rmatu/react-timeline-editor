import { useCallback, memo, useState } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { Clip as ClipComponent } from "./Clip";
import { cn } from "@/lib/utils";
import { isClipVisible } from "@/utils/geometry";
import { pixelsToTime } from "@/utils/time";
import { TRACK_COLORS } from "@/constants/timeline.constants";
import type { Track as TrackType, Clip, VideoClip, AudioClip, StickerClip } from "@/schemas";
import { parseMediaDragData } from "@/components/sidepanel/panels/MediaLibraryPanel";

interface TrackProps {
  track: TrackType;
  clips: Clip[];
  zoomLevel: number;
  scrollX: number;
  selectedClipIds: string[];
}

export const Track = memo(function Track({
  track,
  clips,
  zoomLevel,
  scrollX,
  selectedClipIds,
}: TrackProps) {
  const selectedTrackId = useTimelineStore((state) => state.selectedTrackId);
  const selectTrack = useTimelineStore((state) => state.selectTrack);
  const selectClip = useTimelineStore((state) => state.selectClip);
  const addClip = useTimelineStore((state) => state.addClip);
  
  const isSelected = selectedTrackId === track.id;
  const [isDragOver, setIsDragOver] = useState(false);

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

  // Handle drag over for media items
  // Note: getData() returns empty during dragover for security, so we check types instead
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      const types = e.dataTransfer.types;
      // Check if this looks like our media drag data (we'll verify the actual type in drop)
      if (types.includes('application/json') || types.includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Handle drop of media items
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDragOver(false);
      const mediaData = parseMediaDragData(e);
      if (!mediaData) return;

      const item = mediaData.item;

      // Sticker tracks accept image media items
      if (track.type === 'sticker' && item.type === 'image') {
        e.preventDefault();

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const xInTrack = e.clientX - rect.left + scrollX;
        const startTime = Math.max(0, pixelsToTime(xInTrack, zoomLevel));

        const stickerClip: StickerClip = {
          id: crypto.randomUUID(),
          trackId: track.id,
          type: 'sticker',
          assetId: item.id,
          assetUrl: item.url,
          name: item.name,
          startTime,
          duration: 5, // Default 5 seconds for images
          sourceStartTime: 0,
          locked: false,
          muted: false,
          scale: 1,
          rotation: 0,
          opacity: 1,
          position: { x: 50, y: 50 },
          isAnimated: item.isAnimated ?? false,
        };
        addClip(stickerClip);
        return;
      }

      // Video/audio tracks only accept matching types
      if (item.type !== track.type) return;

      e.preventDefault();

      // Calculate drop position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const xInTrack = e.clientX - rect.left + scrollX;
      const startTime = Math.max(0, pixelsToTime(xInTrack, zoomLevel));

      // Create clip
      const baseClip = {
        id: crypto.randomUUID(),
        trackId: track.id,
        type: item.type,
        name: item.name,
        startTime,
        duration: item.duration || 10,
        sourceStartTime: 0,
        sourceUrl: item.url,
        volume: 1,
        locked: false,
        muted: false,
      };

      if (item.type === 'video') {
        const videoClip: VideoClip = {
          ...baseClip,
          type: 'video',
          playbackRate: 1,
          maxDuration: item.duration,
          thumbnailUrl: item.thumbnailUrl,
        };
        addClip(videoClip);
      } else if (item.type === 'audio') {
        const audioClip: AudioClip = {
          ...baseClip,
          type: 'audio',
          fadeIn: 0,
          fadeOut: 0,
        };
        addClip(audioClip);
      }
    },
    [track.id, track.type, scrollX, zoomLevel, addClip]
  );

  return (
    <div
      className={cn(
        "relative border-b border-zinc-700 transition-colors",
        isSelected ? "bg-zinc-800/50" : "bg-zinc-900",
        isDragOver && "bg-blue-900/20 border-blue-500/50",
        track.locked && "opacity-60",
        !track.visible && "opacity-30"
      )}
      style={{ height: track.height }}
      onClick={handleTrackClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
      {isSelected && !isDragOver && (
        <div className="pointer-events-none absolute inset-0 border-2 border-blue-500/30" />
      )}

      {/* Drop target highlight */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 border-2 border-blue-500 bg-blue-500/10" />
      )}
    </div>
  );
});
