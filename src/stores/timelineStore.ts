import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { devtools } from "zustand/middleware";
import type { Clip, Track } from "@/schemas";
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_DURATION,
  DEFAULT_FPS,
} from "@/constants/timeline.constants";

export interface TimelineExport {
  fps: number;
  duration: number;
  resolution: { width: number; height: number };
  tracks: Track[];
  clips: Clip[];
}

// Subtitle entry for SRT files
export interface Subtitle {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

// Media library item - single source of truth for all imported media
export interface MediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'srt';
  url: string;
  duration?: number;
  thumbnailUrl?: string;
  // For SRT files
  subtitles?: Subtitle[];
}

// Enable Immer support for Map and Set
enableMapSet();

interface TimelineState {
  // Timeline configuration
  fps: number;
  totalDuration: number;
  resolution: { width: number; height: number };

  // Viewport state
  zoomLevel: number;
  scrollX: number;
  scrollY: number;

  // Playback state
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  loop: boolean;
  loopStart: number | null;
  loopEnd: number | null;

  // Selection state
  selectedClipIds: string[];
  selectedTrackId: string | null;

  // Interaction state
  isDragging: boolean;
  isTrimming: boolean;
  activeClipId: string | null;

  // Data
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;

  // Media library - single source of truth for imported media
  mediaLibrary: Map<string, MediaItem>;

  // History for undo/redo
  history: Array<{ tracks: Map<string, Track>; clips: Map<string, Clip> }>;
  historyIndex: number;
  maxHistoryLength: number;
}

interface TimelineActions {
  // Viewport actions
  setZoom: (level: number) => void;
  setZoomAroundPoint: (level: number, centerX: number) => void;
  setScroll: (x: number, y: number) => void;
  scrollBy: (dx: number, dy: number) => void;

  // Playback actions
  setCurrentTime: (time: number) => void;
  togglePlayback: () => void;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  setLoop: (enabled: boolean, start?: number, end?: number) => void;

  // Selection actions
  selectClip: (clipId: string, multi?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  deselectAll: () => void;
  selectTrack: (trackId: string | null) => void;

  // Interaction state
  setDragging: (isDragging: boolean, clipId?: string) => void;
  setTrimming: (isTrimming: boolean, clipId?: string) => void;

  // Track actions
  addTrack: (track: Track) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  removeTrack: (trackId: string) => void;
  reorderTracks: (trackIds: string[]) => void;

  // Clip actions
  addClip: (clip: Clip) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  removeClip: (clipId: string) => void;
  removeSelectedClips: () => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  trimClip: (
    clipId: string,
    side: "left" | "right",
    newDuration: number,
    newStartTime?: number,
    newSourceStartTime?: number
  ) => void;
  splitClip: (clipId: string, splitTime: number) => boolean;
  mergeClips: (clipIds: string[]) => boolean;

  // History actions
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Timeline configuration
  setDuration: (duration: number, trimClips?: boolean) => void;
  setFps: (fps: number) => void;
  setResolution: (width: number, height: number) => void;

  // Bulk operations
  loadTimeline: (tracks: Track[], clips: Clip[], mediaLibrary?: MediaItem[]) => void;
  exportTimeline: () => TimelineExport;
  clearTimeline: () => void;

  // Media library actions
  addMediaItem: (item: MediaItem) => void;
  removeMediaItem: (id: string) => void;
  updateMediaItem: (id: string, updates: Partial<MediaItem>) => void;
}

type TimelineStore = TimelineState & TimelineActions;

export const useTimelineStore = create<TimelineStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      fps: DEFAULT_FPS,
      totalDuration: DEFAULT_DURATION,
      resolution: { width: 1920, height: 1080 },

      zoomLevel: DEFAULT_ZOOM,
      scrollX: 0,
      scrollY: 0,

      currentTime: 0,
      isPlaying: false,
      playbackRate: 1,
      loop: false,
      loopStart: null,
      loopEnd: null,

      selectedClipIds: [],
      selectedTrackId: null,

      isDragging: false,
      isTrimming: false,
      activeClipId: null,

      tracks: new Map(),
      clips: new Map(),

      mediaLibrary: new Map(),

      history: [],
      historyIndex: -1,
      maxHistoryLength: 50,

      // Viewport actions
      setZoom: (level) =>
        set((state) => {
          state.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
        }),

      setZoomAroundPoint: (level, centerX) =>
        set((state) => {
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
          const timeAtCenter =
            (state.scrollX + centerX) / state.zoomLevel;
          const newScrollX = timeAtCenter * newZoom - centerX;
          state.zoomLevel = newZoom;
          state.scrollX = Math.max(0, newScrollX);
        }),

      setScroll: (x, y) =>
        set((state) => {
          state.scrollX = Math.max(0, x);
          state.scrollY = Math.max(0, y);
        }),

      scrollBy: (dx, dy) =>
        set((state) => {
          state.scrollX = Math.max(0, state.scrollX + dx);
          state.scrollY = Math.max(0, state.scrollY + dy);
        }),

      // Playback actions
      setCurrentTime: (time) =>
        set((state) => {
          state.currentTime = Math.max(
            0,
            Math.min(state.totalDuration, time)
          );
        }),

      togglePlayback: () =>
        set((state) => {
          state.isPlaying = !state.isPlaying;
        }),

      play: () =>
        set((state) => {
          state.isPlaying = true;
        }),

      pause: () =>
        set((state) => {
          state.isPlaying = false;
        }),

      setPlaybackRate: (rate) =>
        set((state) => {
          state.playbackRate = rate;
        }),

      setLoop: (enabled, start, end) =>
        set((state) => {
          state.loop = enabled;
          state.loopStart = start ?? null;
          state.loopEnd = end ?? null;
        }),

      // Selection actions
      selectClip: (clipId, multi = false) =>
        set((state) => {
          if (multi) {
            if (state.selectedClipIds.includes(clipId)) {
              state.selectedClipIds = state.selectedClipIds.filter(
                (id) => id !== clipId
              );
            } else {
              state.selectedClipIds.push(clipId);
            }
          } else {
            state.selectedClipIds = [clipId];
          }
        }),

      selectClips: (clipIds) =>
        set((state) => {
          state.selectedClipIds = clipIds;
        }),

      deselectAll: () =>
        set((state) => {
          state.selectedClipIds = [];
          state.selectedTrackId = null;
        }),

      selectTrack: (trackId) =>
        set((state) => {
          state.selectedTrackId = trackId;
        }),

      // Interaction state
      setDragging: (isDragging, clipId) =>
        set((state) => {
          state.isDragging = isDragging;
          state.activeClipId = isDragging ? (clipId ?? null) : null;
        }),

      setTrimming: (isTrimming, clipId) =>
        set((state) => {
          state.isTrimming = isTrimming;
          state.activeClipId = isTrimming ? (clipId ?? null) : null;
        }),

      // Track actions
      addTrack: (track) =>
        set((state) => {
          state.tracks.set(track.id, track);
        }),

      updateTrack: (trackId, updates) =>
        set((state) => {
          const track = state.tracks.get(trackId);
          if (track) {
            state.tracks.set(trackId, { ...track, ...updates });
          }
        }),

      removeTrack: (trackId) =>
        set((state) => {
          state.tracks.delete(trackId);
          // Remove all clips on this track
          for (const [clipId, clip] of state.clips) {
            if (clip.trackId === trackId) {
              state.clips.delete(clipId);
            }
          }
        }),

      reorderTracks: (trackIds) =>
        set((state) => {
          trackIds.forEach((trackId, index) => {
            const track = state.tracks.get(trackId);
            if (track) {
              state.tracks.set(trackId, { ...track, order: index });
            }
          });
        }),

      // Clip actions
      addClip: (clip) =>
        set((state) => {
          state.clips.set(clip.id, clip);
        }),

      updateClip: (clipId, updates) =>
        set((state) => {
          const clip = state.clips.get(clipId);
          if (clip) {
            state.clips.set(clipId, { ...clip, ...updates } as Clip);
          }
        }),

      removeClip: (clipId) =>
        set((state) => {
          state.clips.delete(clipId);
          state.selectedClipIds = state.selectedClipIds.filter(
            (id) => id !== clipId
          );
        }),

      removeSelectedClips: () =>
        set((state) => {
          for (const clipId of state.selectedClipIds) {
            state.clips.delete(clipId);
          }
          state.selectedClipIds = [];
        }),

      moveClip: (clipId, newStartTime, newTrackId) =>
        set((state) => {
          const clip = state.clips.get(clipId);
          if (clip) {
            const updates: Partial<Clip> = {
              startTime: Math.max(0, newStartTime),
            };
            if (newTrackId && state.tracks.has(newTrackId)) {
              updates.trackId = newTrackId;
            }
            const updatedClip = { ...clip, ...updates } as Clip;
            state.clips.set(clipId, updatedClip);

            // Auto-extend duration if needed
            const clipEnd = updatedClip.startTime + updatedClip.duration;
            if (clipEnd > state.totalDuration) {
              state.totalDuration = Math.ceil(clipEnd);
            }
          }
        }),

      trimClip: (clipId, _side, newDuration, newStartTime, newSourceStartTime) =>
        set((state) => {
          const clip = state.clips.get(clipId);
          if (clip) {
            const updates: Partial<Clip> = { duration: newDuration };
            if (newStartTime !== undefined) {
              updates.startTime = newStartTime;
            }
            if (newSourceStartTime !== undefined) {
              updates.sourceStartTime = newSourceStartTime;
            }
            const updatedClip = { ...clip, ...updates } as Clip;
            state.clips.set(clipId, updatedClip);

            // Auto-extend duration if needed
            const clipEnd = updatedClip.startTime + updatedClip.duration;
            if (clipEnd > state.totalDuration) {
              state.totalDuration = Math.ceil(clipEnd);
            }
          }
        }),

      splitClip: (clipId, splitTime) => {
        const state = get();
        const clip = state.clips.get(clipId);
        if (!clip) return false;

        const clipEnd = clip.startTime + clip.duration;
        // Validate split time is within clip bounds (not at edges)
        const minSplitTime = clip.startTime + 0.1;
        const maxSplitTime = clipEnd - 0.1;
        if (splitTime <= minSplitTime || splitTime >= maxSplitTime) {
          return false;
        }

        const leftDuration = splitTime - clip.startTime;
        const rightDuration = clipEnd - splitTime;

        // Create left clip (keeps original ID for simplicity, or use new ID)
        const leftClip: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          duration: leftDuration,
        };

        // Create right clip with adjusted sourceStartTime for video/audio
        const rightClip: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          startTime: splitTime,
          duration: rightDuration,
          sourceStartTime:
            clip.type === "video" || clip.type === "audio"
              ? clip.sourceStartTime + leftDuration
              : clip.sourceStartTime,
        };

        set((s) => {
          s.clips.delete(clipId);
          s.clips.set(leftClip.id, leftClip);
          s.clips.set(rightClip.id, rightClip);
          // Update selection to new clips
          s.selectedClipIds = s.selectedClipIds.filter((id) => id !== clipId);
          s.selectedClipIds.push(leftClip.id, rightClip.id);
        });

        return true;
      },

      mergeClips: (clipIds) => {
        const state = get();
        if (clipIds.length < 2) return false;

        // Get all clips and validate
        const clipsToMerge = clipIds
          .map((id) => state.clips.get(id))
          .filter((c): c is Clip => c !== undefined);

        if (clipsToMerge.length < 2) return false;

        // All must be same type and same track
        const firstClip = clipsToMerge[0];
        const allSameType = clipsToMerge.every(
          (c) => c.type === firstClip.type && c.trackId === firstClip.trackId
        );
        if (!allSameType) return false;

        // Sort by start time
        clipsToMerge.sort((a, b) => a.startTime - b.startTime);

        // Check if clips are adjacent (within 0.1s tolerance)
        for (let i = 0; i < clipsToMerge.length - 1; i++) {
          const currentEnd = clipsToMerge[i].startTime + clipsToMerge[i].duration;
          const nextStart = clipsToMerge[i + 1].startTime;
          if (Math.abs(currentEnd - nextStart) > 0.1) {
            return false; // Not adjacent
          }
        }

        // For video/audio, check same source and contiguous sourceStartTime
        if (firstClip.type === "video" || firstClip.type === "audio") {
          const firstSource = (firstClip as { sourceUrl: string }).sourceUrl;
          const allSameSource = clipsToMerge.every(
            (c) => (c as { sourceUrl: string }).sourceUrl === firstSource
          );
          if (!allSameSource) return false;

          // Check contiguous sourceStartTime
          for (let i = 0; i < clipsToMerge.length - 1; i++) {
            const currentSourceEnd =
              clipsToMerge[i].sourceStartTime + clipsToMerge[i].duration;
            const nextSourceStart = clipsToMerge[i + 1].sourceStartTime;
            if (Math.abs(currentSourceEnd - nextSourceStart) > 0.1) {
              return false; // Not contiguous source
            }
          }
        }

        // Create merged clip
        const mergedClip: Clip = {
          ...firstClip,
          id: crypto.randomUUID(),
          startTime: clipsToMerge[0].startTime,
          duration: clipsToMerge.reduce((sum, c) => sum + c.duration, 0),
          sourceStartTime: clipsToMerge[0].sourceStartTime,
        };

        set((s) => {
          // Remove original clips
          for (const clipId of clipIds) {
            s.clips.delete(clipId);
          }
          s.clips.set(mergedClip.id, mergedClip);
          // Update selection
          s.selectedClipIds = s.selectedClipIds.filter(
            (id) => !clipIds.includes(id)
          );
          s.selectedClipIds.push(mergedClip.id);
        });

        return true;
      },

      // History actions
      saveToHistory: () =>
        set((state) => {
          // Remove any forward history if we're not at the end
          if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
          }

          // Save current state
          state.history.push({
            tracks: new Map(state.tracks),
            clips: new Map(state.clips),
          });

          // Trim history if too long
          if (state.history.length > state.maxHistoryLength) {
            state.history = state.history.slice(-state.maxHistoryLength);
          }

          state.historyIndex = state.history.length - 1;
        }),

      undo: () =>
        set((state) => {
          if (state.historyIndex >= 0 && state.history.length > 0) {
            const entry = state.history[state.historyIndex];
            if (entry) {
              state.tracks = new Map(entry.tracks);
              state.clips = new Map(entry.clips);
            }
            // Move back in history for next undo
            if (state.historyIndex > 0) {
              state.historyIndex--;
            }
          }
        }),

      redo: () =>
        set((state) => {
          if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const entry = state.history[state.historyIndex];
            state.tracks = new Map(entry.tracks);
            state.clips = new Map(entry.clips);
          }
        }),

      canUndo: () => get().history.length > 0 && get().historyIndex >= 0,
      canRedo: () => get().historyIndex < get().history.length - 1,

      // Timeline configuration
      setDuration: (duration, trimClips = false) =>
        set((state) => {
          // If we are trimming clips, we enforce the new duration
          if (trimClips) {
            state.totalDuration = Math.max(1, duration);

            // Remove or trim clips that are out of bounds
            const clipIdsToRemove: string[] = [];

            for (const [id, clip] of state.clips) {
              if (clip.startTime >= state.totalDuration) {
                // Clip starts after the new end time, remove it
                clipIdsToRemove.push(id);
              } else if (clip.startTime + clip.duration > state.totalDuration) {
                // Clip overlaps the end, trim it
                const newDuration = state.totalDuration - clip.startTime;

                // For video/audio, we might also want to adjust sourceStartTime? 
                // No, sourceStartTime stays the same, we just cut the end.
                // However, the trimClip action typically handles this update.
                // Here we just update the clip directly since we are inside an immer producer.

                state.clips.set(id, {
                  ...clip,
                  duration: newDuration
                });
              }
            }

            // Remove fully out-of-bounds clips
            for (const id of clipIdsToRemove) {
              state.clips.delete(id);
              // Also remove from selection if present
              state.selectedClipIds = state.selectedClipIds.filter(selId => selId !== id);
            }

          } else {
            // Default behavior: Don't allow duration less than content or 1s
            let maxClipEnd = 0;
            for (const clip of state.clips.values()) {
              maxClipEnd = Math.max(maxClipEnd, clip.startTime + clip.duration);
            }
            state.totalDuration = Math.max(1, maxClipEnd, duration);
          }
        }),

      setFps: (fps) =>
        set((state) => {
          state.fps = fps;
        }),

      setResolution: (width, height) =>
        set((state) => {
          state.resolution = { width, height };
        }),

      // Bulk operations
      loadTimeline: (tracks, clips, mediaLibrary) =>
        set((state) => {
          state.tracks = new Map(tracks.map((t) => [t.id, t]));
          state.clips = new Map(clips.map((c) => [c.id, c]));
          if (mediaLibrary) {
            state.mediaLibrary = new Map(mediaLibrary.map((m) => [m.id, m]));
          }
          state.selectedClipIds = [];
          state.selectedTrackId = null;
          state.history = [];
          state.historyIndex = -1;
        }),

      clearTimeline: () =>
        set((state) => {
          state.tracks = new Map();
          state.clips = new Map();
          state.mediaLibrary = new Map();
          state.selectedClipIds = [];
          state.selectedTrackId = null;
          state.currentTime = 0;
          state.isPlaying = false;
        }),

      exportTimeline: () => {
        const state = get();
        return {
          fps: state.fps,
          duration: state.totalDuration,
          resolution: state.resolution,
          tracks: Array.from(state.tracks.values()),
          clips: Array.from(state.clips.values()),
        };
      },

      // Media library actions
      addMediaItem: (item) =>
        set((state) => {
          state.mediaLibrary.set(item.id, item);
        }),

      removeMediaItem: (id) =>
        set((state) => {
          state.mediaLibrary.delete(id);
        }),

      updateMediaItem: (id, updates) =>
        set((state) => {
          const item = state.mediaLibrary.get(id);
          if (item) {
            state.mediaLibrary.set(id, { ...item, ...updates });
          }
        }),
    })),
    { name: "timeline-store" }
  )
);

// Selector hooks for optimized re-renders
export const useZoomLevel = () => useTimelineStore((state) => state.zoomLevel);
export const useCurrentTime = () =>
  useTimelineStore((state) => state.currentTime);
export const useIsPlaying = () => useTimelineStore((state) => state.isPlaying);
export const useSelectedClipIds = () =>
  useTimelineStore((state) => state.selectedClipIds);
export const useTracks = () => useTimelineStore((state) => state.tracks);
export const useClips = () => useTimelineStore((state) => state.clips);
export const useMediaLibrary = () => useTimelineStore((state) => state.mediaLibrary);
