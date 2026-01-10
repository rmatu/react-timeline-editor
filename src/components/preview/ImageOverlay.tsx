import { useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { StickerClip } from "@/schemas";
import { DraggableImageItem } from "./DraggableImageItem";

interface ImageOverlayProps {
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

import { Z_INDEX } from "@/constants/timeline.constants";

export function ImageOverlay({ currentTime, containerRef }: ImageOverlayProps) {
  const { clips, tracks } = useTimelineStore();

  // Find all active sticker clips at current time
  const activeStickerClips = useMemo(() => {
    return Array.from(clips.values()).filter(
      (clip): clip is StickerClip =>
        clip.type === "sticker" &&
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration &&
        tracks.get(clip.trackId)?.visible !== false
    );
  }, [clips, tracks, currentTime]);

  if (activeStickerClips.length === 0) return null;

  // Calculate max track order for z-index inversion
  // Higher track in list (lower order) = Higher z-index
  const maxTrackOrder = useMemo(() => {
    let max = 0;
    tracks.forEach(track => {
      if (track.order > max) max = track.order;
    });
    return max;
  }, [tracks]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {activeStickerClips.map((clip) => {
        const track = tracks.get(clip.trackId);
        // Base content z-index + inverted track order (so track 0 is on top)
        const zIndex = Z_INDEX.PREVIEW.CONTENT_BASE + (maxTrackOrder - (track?.order ?? 0));
        
        return (
          <DraggableImageItem
            key={clip.id}
            clip={clip}
            currentTime={currentTime}
            containerRef={containerRef}
            zIndex={zIndex}
          />
        );
      })}
    </div>
  );
}
