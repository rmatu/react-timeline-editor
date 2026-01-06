import { useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TextClip } from "@/schemas";

interface TextOverlayProps {
  currentTime: number;
}

export function TextOverlay({ currentTime }: TextOverlayProps) {
  const { clips } = useTimelineStore();

  // Find all active text clips at current time
  const activeTextClips = useMemo(() => {
    return Array.from(clips.values()).filter(
      (clip): clip is TextClip =>
        clip.type === "text" &&
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration
    );
  }, [clips, currentTime]);

  if (activeTextClips.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {activeTextClips.map((clip) => (
        <div
          key={clip.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${clip.position.x}%`,
            top: `${clip.position.y}%`,
            fontFamily: clip.fontFamily,
            fontSize: `${clip.fontSize}px`,
            fontWeight: clip.fontWeight,
            color: clip.color,
            backgroundColor: clip.backgroundColor || "transparent",
            textAlign: clip.textAlign,
            padding: clip.backgroundColor ? "4px 8px" : 0,
            borderRadius: clip.backgroundColor ? 4 : 0,
            whiteSpace: "nowrap",
            textShadow: !clip.backgroundColor ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
          }}
        >
          {clip.content}
        </div>
      ))}
    </div>
  );
}
