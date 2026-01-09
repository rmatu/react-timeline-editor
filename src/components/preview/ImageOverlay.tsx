import { useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { StickerClip } from "@/schemas";
import { DraggableImageItem } from "./DraggableImageItem";

interface ImageOverlayProps {
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

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

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {activeStickerClips.map((clip) => (
        <DraggableImageItem
          key={clip.id}
          clip={clip}
          currentTime={currentTime}
          containerRef={containerRef}
        />
      ))}
    </div>
  );
}
