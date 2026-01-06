import { memo } from "react";
import type { Clip, VideoClip, AudioClip, TextClip, StickerClip } from "@/schemas";

interface ClipContentProps {
  clip: Clip;
  width: number;
  isSelected: boolean;
}

export const ClipContent = memo(function ClipContent({
  clip,
  width,
  isSelected: _isSelected,
}: ClipContentProps) {
  void _isSelected; // Available for future selection-based rendering
  switch (clip.type) {
    case "video":
      return <VideoClipContent clip={clip} width={width} />;
    case "audio":
      return <AudioClipContent clip={clip} width={width} />;
    case "text":
      return <TextClipContent clip={clip} width={width} />;
    case "sticker":
      return <StickerClipContent clip={clip} width={width} />;
    default:
      return null;
  }
});

// Video clip: thumbnail strip
function VideoClipContent({ clip, width }: { clip: VideoClip; width: number }) {
  const thumbnails = clip.thumbnails || (clip.thumbnailUrl ? [clip.thumbnailUrl] : []);

  if (thumbnails.length === 0) {
    // Placeholder gradient
    return (
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-blue-500/30" />
    );
  }

  // Calculate how many thumbnails to show based on width
  const thumbWidth = 60;
  const thumbCount = Math.max(1, Math.ceil(width / thumbWidth));

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {Array.from({ length: thumbCount }).map((_, i) => {
        const thumbIndex = Math.floor((i / thumbCount) * thumbnails.length);
        const thumbUrl = thumbnails[thumbIndex] || thumbnails[0];
        return (
          <img
            key={i}
            src={thumbUrl}
            alt=""
            className="h-full flex-shrink-0 object-cover opacity-60"
            style={{ width: thumbWidth }}
            loading="lazy"
            draggable={false}
          />
        );
      })}
    </div>
  );
}

// Audio clip: waveform visualization
function AudioClipContent({ clip, width }: { clip: AudioClip; width: number }) {
  const waveformData = clip.waveformData;

  if (!waveformData || waveformData.length === 0) {
    // Placeholder pattern
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-full w-full items-center gap-px px-1">
          {Array.from({ length: Math.min(50, Math.floor(width / 4)) }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full bg-green-400/40"
              style={{
                height: `${20 + Math.random() * 60}%`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Sample waveform data to fit width
  const samplesCount = Math.min(waveformData.length, Math.floor(width / 2));
  const step = Math.floor(waveformData.length / samplesCount);

  return (
    <div className="absolute inset-0 flex items-center px-1">
      <svg className="h-full w-full" preserveAspectRatio="none">
        {Array.from({ length: samplesCount }).map((_, i) => {
          const value = waveformData[i * step] || 0;
          const height = value * 100;
          const x = (i / samplesCount) * 100;
          return (
            <rect
              key={i}
              x={`${x}%`}
              y={`${50 - height / 2}%`}
              width="1"
              height={`${height}%`}
              fill="rgba(74, 222, 128, 0.6)"
              rx="0.5"
            />
          );
        })}
      </svg>
    </div>
  );
}

// Text clip: content preview
function TextClipContent({ clip }: { clip: TextClip; width: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-2">
      <span
        className="truncate text-center text-sm font-medium"
        style={{
          color: clip.color,
          fontFamily: clip.fontFamily,
        }}
      >
        {clip.content || "Text"}
      </span>
    </div>
  );
}

// Sticker clip: asset preview
function StickerClipContent({ clip }: { clip: StickerClip; width: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-1">
      <img
        src={clip.assetUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        style={{
          transform: `rotate(${clip.rotation}deg) scale(${Math.min(1, clip.scale)})`,
          opacity: clip.opacity,
        }}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}
