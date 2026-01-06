import { memo, useState, useEffect, useRef } from "react";
import type { Clip, VideoClip, AudioClip, TextClip, StickerClip } from "@/schemas";
import { useAudioWaveform } from "@/hooks/useAudioWaveform";

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
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([]);
  const thumbHeight = 40; // Approx height of clip
  const thumbWidth = (thumbHeight * 16) / 9; // Assume 16:9 for now
  const thumbCount = Math.max(1, Math.ceil(width / thumbWidth));
  const generationRef = useRef(false);

  // Use provided thumbnails or generated ones
  const thumbnails =
    clip.thumbnails && clip.thumbnails.length > 0
      ? clip.thumbnails
      : generatedThumbnails.length > 0
      ? generatedThumbnails
      : clip.thumbnailUrl
      ? [clip.thumbnailUrl]
      : [];

  useEffect(() => {
    // If we already have enough thumbnails from the clip data, don't generate
    if (clip.thumbnails && clip.thumbnails.length >= thumbCount) return;

    // If already generating or generated for this count, skip
    if (generationRef.current || generatedThumbnails.length >= thumbCount)
      return;

    // Start generation
    generationRef.current = true;
    const video = document.createElement("video");
    video.src = clip.sourceUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Thumbnails to collect
    const newThumbnails: string[] = [];
    let isCancelled = false;

    const generate = async () => {
      try {
        await new Promise((resolve, reject) => {
          video.onloadeddata = () => resolve(true);
          video.onerror = (e) => reject(e);
        });

        // Aspect ratio for canvas
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        
        // Calculate correct thumb width based on aspect ratio
        const aspect = vw / vh;
        const actualThumbWidth = thumbHeight * aspect;
        
        canvas.width = actualThumbWidth * 2; // Retina
        canvas.height = thumbHeight * 2;

        const totalDuration = clip.duration;
        const step = totalDuration / thumbCount;

        for (let i = 0; i < thumbCount; i++) {
          if (isCancelled) break;

          // Calculate time relative to the source video, taking clip start time into account
          const time = clip.sourceStartTime + i * step;
          video.currentTime = Math.min(time, video.duration);

          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            };
            video.addEventListener("seeked", onSeeked);
          });

          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Low quality JPEG for memory efficiency
            const url = canvas.toDataURL("image/jpeg", 0.7);
            newThumbnails.push(url);
            // Update incrementally to show progress
            setGeneratedThumbnails([...newThumbnails]);
          }
        }
      } catch (e) {
        console.error("Thumbnail generation failed", e);
      } finally {
        // Cleanup
        generationRef.current = false;
        video.src = "";
        video.remove();
      }
    };

    generate();

    return () => {
      isCancelled = true;
    };
  }, [
    clip.sourceUrl,
    clip.sourceStartTime,
    clip.duration,
    thumbCount,
    clip.thumbnails,
  ]);

  if (thumbnails.length === 0) {
    return (
      <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center">
         <span className="text-xs text-white/20">Loading preview...</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-black">
      {Array.from({ length: thumbCount }).map((_, i) => {
        let thumbUrl = "";

        if (thumbnails.length >= thumbCount) {
          thumbUrl = thumbnails[i];
        } else {
          // Stretch logic
          const index = Math.floor((i / thumbCount) * thumbnails.length);
          thumbUrl = thumbnails[index] || thumbnails[0];
        }

        return (
          <img
            key={i}
            src={thumbUrl}
            alt=""
            className="h-full flex-1 object-cover"
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
  // Use a reasonable sample count based on width, but cap it for performance
  const samples = Math.min(Math.floor(width), 500);
  const { waveformData, isLoading } = useAudioWaveform(clip.sourceUrl, {
    samples,
  });

  // Fallback to existing data or empty
  const data =
    waveformData.length > 0
      ? waveformData
      : clip.waveformData || [];

  if (isLoading && data.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-0.5 w-1/2 rounded bg-white/20 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    // Basic placeholder
    return (
      <div className="absolute inset-0 flex items-center justify-center opacity-50">
        <div className="w-full h-[1px] bg-white/20" />
      </div>
    );
  }

  // Draw discrete bars for "frequency visualizer" look
  const barWidth = 3; // px
  const gap = 1; // px
  const totalBarWidth = barWidth + gap;
  const maxBars = Math.floor(width / totalBarWidth);
  
  // Resample data to fit the number of bars
  const displayData: number[] = [];
  const step = data.length / maxBars;
  
  for (let i = 0; i < maxBars; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = data.slice(start, end + 1);
    // Use max value in chunk for better visibility of peaks
    const val = slice.length ? Math.max(...slice) : 0;
    displayData.push(val);
  }

  return (
    <div className="absolute inset-0 pointer-events-none text-white/50">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {displayData.map((val, i) => {
          const height = Math.max(val * 80, 10); // Min height 10%
          const x = i * totalBarWidth;
          return (
            <rect
              key={i}
              x={x}
              y={50 - height / 2}
              width={barWidth}
              height={height}
              rx={barWidth / 2}
              fill="currentColor"
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
