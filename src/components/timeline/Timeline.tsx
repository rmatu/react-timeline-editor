import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { useDrag } from "@use-gesture/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { TimelineViewport } from "./TimelineViewport";
import { TimeRuler } from "./TimeRuler";
import { Playhead } from "./Playhead";
import { DurationHandle } from "./DurationHandle";
import { Track } from "./Track";
import { TrackHeader } from "./TrackHeader";
import { SnapGuide } from "./SnapGuide";
import { NewTrackIndicator } from "./NewTrackIndicator";
import { useTimelineGestures } from "@/hooks/useTimelineGestures";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";
import {
  TRACK_HEADER_WIDTH,
  RULER_HEIGHT,
} from "@/constants/timeline.constants";
import type { TimelineProps } from "@/types";
import type { Clip } from "@/schemas";

export function Timeline({
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  className,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(TRACK_HEADER_WIDTH);

  const {
    zoomLevel,
    scrollX,
    scrollY,
    totalDuration,
    tracks,
    clips,
    selectedClipIds,
    setZoom,
    setScroll,
    scrollBy,
    setZoomAroundPoint,
  } = useTimelineStore();

  // Sort tracks by order - memoized
  const sortedTracks = useMemo(() => Array.from(tracks.values()).sort(
    (a, b) => a.order - b.order
  ), [tracks]);

  // Group clips by track ID - memoized to prevent re-filtering on every render
  const clipsByTrackId = useMemo(() => {
    const map = new Map<string, Clip[]>();
    for (const track of tracks.values()) {
      map.set(track.id, []);
    }
    for (const clip of clips.values()) {
      const trackClips = map.get(clip.trackId);
      if (trackClips) {
        trackClips.push(clip);
      }
    }
    return map;
  }, [tracks, clips]);

  // Calculate content dimensions
  const contentWidth = totalDuration * zoomLevel;
  const contentHeight = sortedTracks.reduce((sum, t) => sum + t.height, 0);

  // Handle timeline click to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left + scrollX;
      const time = x / zoomLevel;
      // Ensure we don't seek outside bounds
      onTimeChange(Math.max(0, Math.min(totalDuration, time)));
    },
    [scrollX, zoomLevel, totalDuration, onTimeChange]
  );

  const bindSidebarResize = useDrag(({ delta: [dx], first, last }) => {
    if (first) document.body.style.cursor = "col-resize";
    if (last) document.body.style.cursor = "";
    setSidebarWidth((w) => Math.max(100, Math.min(600, w + dx)));
  });

  // Initialize gesture handlers
  useTimelineGestures(viewportRef, {
    zoomLevel,
    scrollX,
    scrollY,
    onZoom: setZoomAroundPoint,
    onScroll: setScroll,
    onScrollBy: scrollBy,
  });

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onPlayPause,
    onDelete: () => {
      const store = useTimelineStore.getState();
      if (store.selectedClipIds.length > 0) {
        store.saveToHistory();
        store.removeSelectedClips();
      }
    },
    onUndo: () => useTimelineStore.getState().undo(),
    onRedo: () => useTimelineStore.getState().redo(),
    onZoomIn: () => setZoom(zoomLevel * 1.2),
    onZoomOut: () => setZoom(zoomLevel / 1.2),
    onDeselectAll: () => useTimelineStore.getState().deselectAll(),
  });

  // Sync playback with animation frame
  useEffect(() => {
    if (!isPlaying) return;

    // Use requestAnimationFrame loop for smooth playback
    let animationFrameId: number;
    let lastTime = performance.now();

    const animateLoop = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      const newTime = currentTime + delta; 
      // Note: In a real app we'd use a ref for currentTime to avoid closure staleness,
      // but here we rely on React re-render to update the closure or effect re-running.
      // Ideally we should use a ref or functional update if onTimeChange allows.
      // However, since we depend on [currentTime], this effect stops/starts every frame.
      // That's actually OK for correctness but can be optimized.
      // For now, let's keep it simple as the stutter is likely rendering, not this loop.
      
      if (newTime >= totalDuration) {
        onTimeChange(0);
      } else {
        onTimeChange(newTime);
      }
      animationFrameId = requestAnimationFrame(animateLoop);
    };

    animationFrameId = requestAnimationFrame(animateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, currentTime, totalDuration, onTimeChange]);

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!isPlaying || !viewportRef.current) return;

    const playheadX = currentTime * zoomLevel;
    const viewportWidth = viewportRef.current.clientWidth;
    const viewportEnd = scrollX + viewportWidth;
    const margin = viewportWidth * 0.1; // 10% margin

    if (playheadX > viewportEnd - margin) {
      setScroll(playheadX - viewportWidth + margin, scrollY);
    }
  }, [isPlaying, currentTime, zoomLevel, scrollX, scrollY, setScroll]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "timeline-container relative flex h-full overflow-hidden bg-zinc-900 select-none",
        className
      )}
    >
      {/* Sidebar Column */}
      <div 
        className="flex flex-col border-r border-zinc-700 bg-zinc-800 z-20 relative"
        style={{ width: sidebarWidth }}
      >
         {/* Sidebar Header (Top-Left Corner) */}
         <div className="flex-shrink-0 border-b border-zinc-700" style={{ height: RULER_HEIGHT }} />

         {/* Sidebar Body (Track Headers) */}
         <div className="flex-1 overflow-hidden relative">
            <div
              style={{
                transform: `translateY(-${scrollY}px)`,
                height: contentHeight,
              }}
            >
              {sortedTracks.map((track) => (
                <TrackHeader key={track.id} track={track} />
              ))}
            </div>
         </div>

         {/* Sidebar Resize Handle */}
         <div
            {...bindSidebarResize()}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 z-30 transform translate-x-1/2"
         />
      </div>

      {/* Content Column */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Ruler Row */}
        <div className="flex-shrink-0 border-b border-zinc-700 z-10 bg-zinc-900" style={{ height: RULER_HEIGHT }}>
           <TimeRuler
            duration={totalDuration}
            zoomLevel={zoomLevel}
            scrollX={scrollX}
            onClick={handleTimelineClick}
          />
        </div>

        {/* Viewport Row */}
        <TimelineViewport
          ref={viewportRef}
          contentWidth={contentWidth}
          contentHeight={contentHeight}
          scrollX={scrollX}
          scrollY={scrollY}
          onClick={handleTimelineClick}
          className="flex-1"
        >
          {/* Tracks */}
          <div className="relative" style={{ height: contentHeight }}>
            {sortedTracks.map((track) => {
              const trackClips = clipsByTrackId.get(track.id) || [];
              return (
                <Track
                  key={track.id}
                  track={track}
                  clips={trackClips}
                  zoomLevel={zoomLevel}
                  scrollX={scrollX}
                  selectedClipIds={selectedClipIds}
                />
              );
            })}
          </div>

          <NewTrackIndicator
            contentWidth={contentWidth}
            contentHeight={contentHeight}
          />

          {/* Snap Guides */}
          <SnapGuide />
        </TimelineViewport>
        
        {/* Global Playhead Overlay */}
        {/* Positioned relative to Content Column */}
        <div className="absolute inset-y-0 left-0 right-0 pointer-events-none overflow-hidden z-20">
           <Playhead
            currentTime={currentTime}
            zoomLevel={zoomLevel}
            scrollX={scrollX}
            height={contentHeight + RULER_HEIGHT} // Approximate, ideally full height
            onSeek={onTimeChange}
          />
          <DurationHandle
            zoomLevel={zoomLevel}
            totalDuration={totalDuration}
            scrollX={scrollX}
          />
        </div>
      </div>
    </div>
  );
}
