import { useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TextClip } from "@/schemas";
import { DraggableTextItem } from "./DraggableTextItem";

interface TextOverlayProps {
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

import { Z_INDEX } from "@/constants/timeline.constants";

export function TextOverlay({ currentTime, containerRef }: TextOverlayProps) {
  const { clips, tracks } = useTimelineStore();

  // Find all active text clips at current time
  const activeTextClips = useMemo(() => {
    return Array.from(clips.values()).filter(
      (clip): clip is TextClip =>
        clip.type === "text" &&
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration &&
        tracks.get(clip.trackId)?.visible !== false
    );
  }, [clips, tracks, currentTime]);

  // Calculate max track order for z-index inversion
  const maxTrackOrder = useMemo(() => {
    let max = 0;
    tracks.forEach(track => {
      if (track.order > max) max = track.order;
    });
    return max;
  }, [tracks]);

  if (activeTextClips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {activeTextClips.map((clip) => {
        const track = tracks.get(clip.trackId);
        // Base content z-index + inverted track order
        // Fallback to maxTrackOrder (bottom) if track is missing
        const zIndex = Z_INDEX.PREVIEW.CONTENT_BASE + (maxTrackOrder - (track?.order ?? maxTrackOrder));
        
        return (
          <DraggableTextItem
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
