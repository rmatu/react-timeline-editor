import { memo, useState, useEffect, useRef } from "react";
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
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([]);
  const thumbWidth = 60;
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
    if (generationRef.current || generatedThumbnails.length >= thumbCount) return;

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
        // Small canvas for performance
        canvas.width = 120; // 2x thumbWidth for retina-ish
        canvas.height = (120 * vh) / vw;

        const step = clip.duration / thumbCount;

        for (let i = 0; i < thumbCount; i++) {
          if (isCancelled) break;

          const time = clip.sourceStartTime + (i * step);
          video.currentTime = time;

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
            const url = canvas.toDataURL("image/jpeg", 0.5);
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
  }, [clip.sourceUrl, clip.sourceStartTime, clip.duration, thumbCount, clip.thumbnails]);

  if (thumbnails.length === 0) {
    // Placeholder gradient
    return (
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-blue-500/30 animate-pulse" />
    );
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {Array.from({ length: thumbCount }).map((_, i) => {
        // Find best matching thumbnail
        // If we have distinct thumbnails for positions, use them 1:1
        // If we have fewer thumbnails than slots, repeat/stretch them
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
            className="h-full flex-shrink-0 object-cover opacity-80"
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
