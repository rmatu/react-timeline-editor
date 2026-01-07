import { memo, useState, useEffect, useRef } from "react";
import { Type } from "lucide-react";
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
    // Reset thumbnails if source changes
    setGeneratedThumbnails([]);
  }, [clip.sourceUrl, clip.sourceStartTime]);

  useEffect(() => {
    const targetCount = thumbCount;
    const currentCount = generatedThumbnails.length;

    // If we have enough, stop
    if (currentCount >= targetCount) return;

    // Avoid parallel generation (basic lock)
    if (generationRef.current) return;

    generationRef.current = true;
    const video = document.createElement("video");
    video.src = clip.sourceUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    let isCancelled = false;

    const generate = async () => {
      try {
        // Wait for video metadata to load with timeout fallback
        await new Promise<boolean>((resolve, reject) => {
          // Check if already loaded
          if (video.readyState >= 1) {
            resolve(true);
            return;
          }
          
          const timeoutId = setTimeout(() => {
            reject(new Error("Video load timeout"));
          }, 10000);
          
          video.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            resolve(true);
          };
          video.onerror = (e) => {
            clearTimeout(timeoutId);
            reject(e);
          };
          
          // Trigger load if not started
          video.load();
        });

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const aspect = vw / vh || 16 / 9;
        const actualThumbWidth = thumbHeight * aspect;
        
        canvas.width = actualThumbWidth * 2;
        canvas.height = thumbHeight * 2;

        // Determine step size (time per thumbnail)
        // thumbCount approx covers proper density
        // But here we want to match linear time
        const totalDuration = clip.duration;
        const baseStep = totalDuration / targetCount; 

        // Start from where we left off
        for (let i = currentCount; i < targetCount; i++) {
          if (isCancelled) break;

          const time = clip.sourceStartTime + i * baseStep;
          if (time > video.duration) break;

          video.currentTime = time;

          await new Promise<void>((resolve) => {
             // Check if already at correct time and ready
             if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.1) {
               resolve();
               return;
             }
             
             const onSeeked = () => {
               video.removeEventListener("seeked", onSeeked);
               resolve();
             };
             video.addEventListener("seeked", onSeeked);
             
             // Timeout fallback for seek
             setTimeout(() => {
               video.removeEventListener("seeked", onSeeked);
               resolve();
             }, 1000);
          });

          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL("image/jpeg", 0.7);
            
            // Append safely
            setGeneratedThumbnails(prev => {
                // Ensure we don't insert duplicates or gaps if state shifted
                if (prev.length === i) {
                    return [...prev, url];
                }
                return prev;
            });
          }
        }
      } catch (e) {
        console.error("Thumbnail gen failed", e);
      } finally {
        generationRef.current = false;
        video.src = "";
        video.remove();
      }
    };

    generate();

    return () => {
      isCancelled = true;
      // Reset the generation lock so subsequent effect runs can generate
      generationRef.current = false;
    };
  }, [
    clip.sourceUrl, 
    clip.sourceStartTime, 
    clip.duration, 
    thumbCount, 
    generatedThumbnails.length // Re-run if length mismatch but handled by loops
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
function TextClipContent({ clip, width }: { clip: TextClip; width: number }) {
  // Only show icon if there's enough room
  const showIcon = width > 30;

  return (
    <div className="absolute inset-0 flex items-center justify-start px-2 gap-1.5 pointer-events-none">
      {showIcon && <Type size={12} className="text-white/80 shrink-0" strokeWidth={2.5} />}
      <span
        className="truncate text-xs font-semibold leading-none drop-shadow-sm"
        style={{
          color: "white", // Force white text for better contrast on colored bars
          fontFamily: clip.fontFamily,
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
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
