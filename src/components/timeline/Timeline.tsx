import { useRef, useCallback, useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { TimelineViewport } from "./TimelineViewport";
import { TimeRuler } from "./TimeRuler";
import { Playhead } from "./Playhead";
import { Track } from "./Track";
import { TrackHeader } from "./TrackHeader";
import { SnapGuide } from "./SnapGuide";
import { useTimelineGestures } from "@/hooks/useTimelineGestures";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";
import {
  TRACK_HEADER_WIDTH,
  RULER_HEIGHT,
} from "@/constants/timeline.constants";
import type { TimelineProps } from "@/types";

export function Timeline({
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  className,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

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

  // Sort tracks by order
  const sortedTracks = Array.from(tracks.values()).sort(
    (a, b) => a.order - b.order
  );

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
      onTimeChange(Math.max(0, Math.min(totalDuration, time)));
    },
    [scrollX, zoomLevel, totalDuration, onTimeChange]
  );

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

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      const newTime = currentTime + delta;
      if (newTime >= totalDuration) {
        onTimeChange(0);
      } else {
        onTimeChange(newTime);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

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
    const margin = viewportWidth * 0.1;

    if (playheadX > viewportEnd - margin) {
      setScroll(playheadX - viewportWidth + margin, scrollY);
    }
  }, [isPlaying, currentTime, zoomLevel, scrollX, scrollY, setScroll]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "timeline-container relative flex h-full flex-col overflow-hidden bg-zinc-900",
        className
      )}
    >
      {/* Timeline Header with Ruler */}
      <div className="flex" style={{ height: RULER_HEIGHT }}>
        {/* Empty space above track headers */}
        <div
          className="flex-shrink-0 border-b border-r border-zinc-700 bg-zinc-800"
          style={{ width: TRACK_HEADER_WIDTH }}
        />

        {/* Time Ruler */}
        <div className="relative flex-1 overflow-hidden border-b border-zinc-700">
          <TimeRuler
            duration={totalDuration}
            zoomLevel={zoomLevel}
            scrollX={scrollX}
            currentTime={currentTime}
            onClick={handleTimelineClick}
          />
        </div>
      </div>

      {/* Timeline Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track Headers */}
        <div
          className="flex-shrink-0 overflow-hidden border-r border-zinc-700 bg-zinc-800"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
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

        {/* Viewport (scrollable tracks area) */}
        <TimelineViewport
          ref={viewportRef}
          contentWidth={contentWidth}
          contentHeight={contentHeight}
          scrollX={scrollX}
          scrollY={scrollY}
          onClick={handleTimelineClick}
        >
          {/* Tracks */}
          <div className="relative" style={{ height: contentHeight }}>
            {sortedTracks.map((track) => {
              const trackClips = Array.from(clips.values()).filter(
                (c) => c.trackId === track.id
              );
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

          {/* Playhead */}
          <Playhead
            currentTime={currentTime}
            zoomLevel={zoomLevel}
            scrollX={scrollX}
            height={contentHeight}
            onSeek={onTimeChange}
          />

          {/* Snap Guides */}
          <SnapGuide />
        </TimelineViewport>
      </div>
    </div>
  );
}
