import { useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TextClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";

interface TextOverlayProps {
  currentTime: number;
}

export function TextOverlay({ currentTime }: TextOverlayProps) {
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {activeTextClips.map((clip) => {
        // Get animated properties at current time
        const animated = getAnimatedPropertiesAtTime(clip, currentTime);

        return (
          <div
            key={clip.id}
            className="absolute"
            style={{
              left: `${animated.position.x}%`,
              top: `${animated.position.y}%`,
              transform: `translate(-50%, -50%) scale(${animated.scale}) rotate(${animated.rotation}deg)`,
              opacity: animated.opacity,
              fontFamily: clip.fontFamily,
              fontSize: `${animated.fontSize ?? clip.fontSize}px`,
              fontWeight: clip.fontWeight,
              color: animated.color ?? clip.color,
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
        );
      })}
    </div>
  );
}
