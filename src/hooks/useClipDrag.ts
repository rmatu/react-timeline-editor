import { useState, useRef } from "react";
import { useDrag } from "@use-gesture/react";
import { useAtom } from "jotai";
import { useTimelineStore } from "@/stores/timelineStore";
import { snapGuideAtom, showSnapGuide, hideSnapGuide, newTrackDropTargetAtom, collisionDetectedAtom } from "@/components/timeline/SnapGuide";
import {
  generateSnapPoints,
  snapClipPosition,
  calculateSnapThreshold,
  wouldClipsOverlap,
} from "@/utils/snapping";
import { pixelsToTime, timeToPixels } from "@/utils/time";
import { SNAP_THRESHOLD_PX } from "@/constants/timeline.constants";
import { Clip, createTrack } from "@/schemas";

interface UseClipDragOptions {
  clip: Clip;
  zoomLevel: number;
  disabled?: boolean;
}

export function useClipDrag({ clip, zoomLevel, disabled = false }: UseClipDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [, setSnapGuide] = useAtom(snapGuideAtom);
  const [, setNewTrackDropTarget] = useAtom(newTrackDropTargetAtom);
  const [, setCollisionDetected] = useAtom(collisionDetectedAtom);
  const initialTimeRef = useRef(clip.startTime);

  // Track layout refs
  const trackLayoutRef = useRef<{ id: string; top: number; height: number; order: number }[]>([]);
  const startTrackTopRef = useRef<number>(0);

  const {
    tracks,
    clips,
    currentTime,
    totalDuration,
    moveClip,
    setDragging,
    saveToHistory,
    selectClip,
    selectedClipIds,
    addTrack,
    reorderTracks,
  } = useTimelineStore();

  const bind = useDrag(
    ({ movement: [mx, my], first, last, cancel, memo }) => {
      if (disabled) {
        cancel();
        return;
      }

      if (first) {
        // Capture initial state
        initialTimeRef.current = clip.startTime;
        setIsDragging(true);
        setDragging(true, clip.id);
        saveToHistory();

        // Calculate track layout
        const sortedTracks = Array.from(tracks.values()).sort((a, b) => a.order - b.order);
        let currentTop = 0;
        trackLayoutRef.current = sortedTracks.map((t) => {
          const layout = { id: t.id, top: currentTop, height: t.height, order: t.order };
          currentTop += t.height;
          return layout;
        });

        const currentTrackLayout = trackLayoutRef.current.find(t => t.id === clip.trackId);
        startTrackTopRef.current = currentTrackLayout?.top || 0;

        if (!selectedClipIds.includes(clip.id)) {
          selectClip(clip.id, false);
        }

        return { startTime: clip.startTime, startY: 0 };
      }

      const memoized = memo as { startTime: number; startY: number };
      const startTime = memoized?.startTime ?? clip.startTime;

      // Horizontal positioning logic (Time)
      const deltaTime = pixelsToTime(mx, zoomLevel);
      let newStartTime = Math.max(0, startTime + deltaTime);

      // Snap logic
      const snapPoints = generateSnapPoints(
        Array.from(clips.values()),
        clip.id,
        currentTime,
        totalDuration
      );
      const snapThreshold = calculateSnapThreshold(zoomLevel, SNAP_THRESHOLD_PX);
      const snapResult = snapClipPosition(
        newStartTime,
        clip.duration,
        snapPoints,
        snapThreshold
      );

      if (snapResult.snapped && snapResult.snapPoint) {
        newStartTime = snapResult.snappedTime;
        const snapX = timeToPixels(snapResult.snapPoint.time, zoomLevel);
        showSnapGuide(setSnapGuide, snapX, getSnapTypeLabel(snapResult.snapPoint.type));
      } else {
        hideSnapGuide(setSnapGuide);
      }

      newStartTime = Math.max(0, newStartTime);
      const newX = timeToPixels(newStartTime, zoomLevel);

      // Vertical positioning logic (Tracks)
      const currentAbsY = startTrackTopRef.current + my;
      let targetTrackId = clip.trackId;
      let visualY = my;
      let newDropTarget: "top" | "bottom" | null = null;

      const lastTrackLayout = trackLayoutRef.current[trackLayoutRef.current.length - 1];
      const bottomThreshold = lastTrackLayout ? lastTrackLayout.top + lastTrackLayout.height : 0;

      // Determine target track
      // If above the first track by at least half a track height
      if (currentAbsY < -30) {
        targetTrackId = "NEW_TOP";
        newDropTarget = "top";
        // Snap visual Y to the top edge (absolute 0) so it's visible
        visualY = -startTrackTopRef.current;
      } else if (lastTrackLayout && currentAbsY > bottomThreshold + 10) {
        // If below the last track:
        targetTrackId = "NEW_BOTTOM";
        newDropTarget = "bottom";
        // Snap visual Y to the "new track" position (phantom track below)
        visualY = (bottomThreshold - startTrackTopRef.current) + 10;
      } else {
        // Find track under cursor
        const targetLayout = trackLayoutRef.current.find(
          t => currentAbsY >= t.top && currentAbsY < t.top + t.height
        );

        if (targetLayout) {
          targetTrackId = targetLayout.id;
          // Snap visual Y to target track
          visualY = targetLayout.top - startTrackTopRef.current;
        }
      }

      // Collision detection: check if dropping at this position would overlap
      // Skip if already creating a new track (NEW_TOP or NEW_BOTTOM)
      let hasCollision = false;
      if (targetTrackId !== "NEW_TOP" && targetTrackId !== "NEW_BOTTOM") {
        const allClips = Array.from(clips.values());
        hasCollision = wouldClipsOverlap(clip, newStartTime, allClips, targetTrackId);

        if (hasCollision) {
          // Force creation of new track at top (same behavior as dragging up)
          targetTrackId = "NEW_TOP";
          newDropTarget = "top";
          // Update visual position to show clip going to new track at top
          visualY = -startTrackTopRef.current;
        }
      }

      setCollisionDetected(hasCollision);
      setDragPosition({ x: newX, y: visualY });
      setNewTrackDropTarget(newDropTarget);

      if (last) {
        setNewTrackDropTarget(null);
        setCollisionDetected(false);
        // Commit changes
        if (targetTrackId === "NEW_TOP") {
          // Create new track at top
          const newTrack = createTrack({
            name: `Track ${tracks.size + 1}`,
            type: clip.type, // Same type as clip
            order: 0
          });
          addTrack(newTrack);

          // Reorder existing tracks
          const allTrackIds = Array.from(tracks.values())
            .sort((a, b) => a.order - b.order)
            .map(t => t.id);
          reorderTracks([newTrack.id, ...allTrackIds]);

          moveClip(clip.id, newStartTime, newTrack.id);
        } else if (targetTrackId === "NEW_BOTTOM") {
          // Create new track at bottom
          const sortedTracks = Array.from(tracks.values()).sort((a, b) => a.order - b.order);
          const lastOrder = sortedTracks.length > 0 ? sortedTracks[sortedTracks.length - 1].order : -1;

          const newTrack = createTrack({
            name: `Track ${tracks.size + 1}`,
            type: clip.type,
            order: lastOrder + 1
          });
          addTrack(newTrack);
          moveClip(clip.id, newStartTime, newTrack.id);
        } else if (targetTrackId !== clip.trackId) {
          moveClip(clip.id, newStartTime, targetTrackId);
        } else {
          moveClip(clip.id, newStartTime);
        }

        setIsDragging(false);
        setDragging(false);
        setDragPosition(null);
        hideSnapGuide(setSnapGuide);
      }

      return memoized;
    },
    {
      filterTaps: true,
      threshold: 5,
      pointer: { touch: true },
      // lockDirection: false // Allow free movement
    }
  );

  return {
    bind,
    isDragging,
    dragPosition,
  };
}

function getSnapTypeLabel(type: string): string {
  switch (type) {
    case "clip-start":
      return "Clip Start";
    case "clip-end":
      return "Clip End";
    case "playhead":
      return "Playhead";
    case "timeline-start":
      return "Start";
    case "timeline-end":
      return "End";
    default:
      return "Snap";
  }
}
