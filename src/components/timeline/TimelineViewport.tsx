import { forwardRef, useState, useCallback, useRef, useImperativeHandle, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTrack } from "@/schemas";
import type { VideoClip, AudioClip, StickerClip } from "@/schemas";
import { parseMediaDragData } from "@/components/sidepanel/panels/MediaLibraryPanel";
import { TRANSITION_DRAG_TYPE } from "@/components/sidepanel/panels/TransitionsPanel";
import { pixelsToTime } from "@/utils/time";
import { MarqueeSelection } from "./MarqueeSelection";

interface TimelineViewportProps {
  children: ReactNode;
  contentWidth: number;
  contentHeight: number;
  scrollX: number;
  scrollY: number;
  zoomLevel: number;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const TimelineViewport = forwardRef<HTMLDivElement, TimelineViewportProps>(
  function TimelineViewport(
    {
      children,
      contentWidth,
      contentHeight: _contentHeight,
      scrollX,
      scrollY,
      zoomLevel,
      onClick,
      className,
    },
    ref
  ) {
    void _contentHeight; // Content height managed by children

    const localRef = useRef<HTMLDivElement>(null);
    
    // Expose the local ref to the parent via the forwarded ref
    useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

    const [isDragOver, setIsDragOver] = useState(false);
    const { tracks, addTrack, addClip } = useTimelineStore();
    const toolMode = useTimelineStore((s) => s.toolMode);

    // Handle drag over for media items from sidepanel
    // Note: getData() returns empty during dragover for security, so we check types instead
    const handleDragOver = useCallback((e: React.DragEvent) => {
      const types = e.dataTransfer.types;
      // Ignore transition drags - those are handled by Clip component
      if (types.includes(TRANSITION_DRAG_TYPE)) return;
      // Check if this looks like our media drag data
      if (types.includes('application/json') || types.includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      // Only set drag over to false if we're leaving the viewport entirely
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setIsDragOver(false);
      }
    }, []);

    // Handle drop of media items from sidepanel
    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        setIsDragOver(false);
        const mediaData = parseMediaDragData(e);
        if (!mediaData) return;

        e.preventDefault();
        e.stopPropagation();
        const item = mediaData.item;

        // SRT files can't be dropped directly on timeline
        if (item.type === 'srt') return;

        // Calculate drop position (time)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const xInViewport = e.clientX - rect.left + scrollX;
        const startTime = Math.max(0, pixelsToTime(xInViewport, zoomLevel));

        // Handle image -> sticker clip
        if (item.type === 'image') {
          let track = Array.from(tracks.values()).find((t) => t.type === 'sticker');

          if (!track) {
            track = createTrack({
              name: 'Sticker Track',
              type: 'sticker',
              order: tracks.size,
            });
            addTrack(track);
          }

          const stickerClip: StickerClip = {
            id: crypto.randomUUID(),
            trackId: track.id,
            type: 'sticker',
            assetId: item.id,
            assetUrl: item.url,
            name: item.name,
            startTime,
            duration: 5, // Default 5 seconds for images
            sourceStartTime: 0,
            locked: false,
            muted: false,
            scale: 1,
            rotation: 0,
            opacity: 1,
            position: { x: 50, y: 50 },
            isAnimated: item.isAnimated ?? false,
          };
          addClip(stickerClip);
          return;
        }

        // Find or create appropriate track for video/audio
        const trackType = item.type;
        let track = Array.from(tracks.values()).find((t) => t.type === trackType);

        if (!track) {
          track = createTrack({
            name: `${trackType.charAt(0).toUpperCase() + trackType.slice(1)} Track`,
            type: trackType,
            order: tracks.size,
          });
          addTrack(track);
        }

        // Create clip
        const baseClip = {
          id: crypto.randomUUID(),
          trackId: track.id,
          type: item.type,
          name: item.name,
          startTime,
          duration: item.duration || 10,
          sourceStartTime: 0,
          sourceUrl: item.url,
          volume: 1,
          locked: false,
          muted: false,
        };

        if (item.type === 'video') {
          const videoClip: VideoClip = {
            ...baseClip,
            type: 'video',
            playbackRate: 1,
            maxDuration: item.duration,
            thumbnailUrl: item.thumbnailUrl,
            // Default transform properties
            position: { x: 50, y: 50 },
            scale: 1,
            rotation: 0,
            opacity: 1,
          };
          addClip(videoClip);
        } else if (item.type === 'audio') {
          const audioClip: AudioClip = {
            ...baseClip,
            type: 'audio',
            fadeIn: 0,
            fadeOut: 0,
          };
          addClip(audioClip);
        }
      },
      [tracks, addTrack, addClip, scrollX, zoomLevel]
    );

    return (
      <div
        ref={localRef}
        className={cn(
          "timeline-viewport relative flex-1 overflow-hidden bg-zinc-900",
          isDragOver && "ring-2 ring-blue-500 ring-inset",
          toolMode === "hand" && "cursor-grab active:cursor-grabbing",
          className
        )}
        onClick={onClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ touchAction: "none" }}
      >
        {/* Marquee selection layer - must be before content to receive mouse events on empty space */}
        <MarqueeSelection
          scrollX={scrollX}
          scrollY={scrollY}
          zoomLevel={zoomLevel}
          containerRef={localRef}
        />

        {/* Content container with transform for virtual scrolling */}
        <div
          className="relative"
          style={{
            width: contentWidth,
            minHeight: "100%",
            transform: `translate(-${scrollX}px, -${scrollY}px)`,
          }}
        >
          {children}
        </div>

        {/* Grid background pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "50px 60px",
            backgroundPosition: `-${scrollX % 50}px -${scrollY % 60}px`,
          }}
        />

        {/* Drop overlay hint */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 bg-blue-500/10">
            <div className="absolute top-3 right-3 rounded-lg bg-blue-500/90 px-3 py-1.5 text-white text-xs font-medium shadow-lg">
              Drop to add to timeline
            </div>
          </div>
        )}
      </div>
    );
  }
);
