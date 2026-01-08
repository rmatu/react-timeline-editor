import { useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TextClip } from "@/schemas";
import { DraggableTextItem } from "./DraggableTextItem";

interface TextOverlayProps {
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

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

  if (activeTextClips.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden z-20 pointer-events-none">
      {activeTextClips.map((clip) => (
        <DraggableTextItem
          key={clip.id}
          clip={clip}
          currentTime={currentTime}
          containerRef={containerRef}
        />
      ))}
    </div>
  );
}
