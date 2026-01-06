import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { Clip } from "@/schemas";

// Base atom for all clips - synced with Zustand store
export const clipsMapAtom = atom<Map<string, Clip>>(new Map());

// Atom family for individual clip access
// This prevents re-renders of all clips when one clip changes
export const clipAtomFamily = atomFamily((clipId: string) =>
  atom(
    (get) => get(clipsMapAtom).get(clipId),
    (get, set, update: Partial<Clip>) => {
      const clips = new Map(get(clipsMapAtom));
      const existing = clips.get(clipId);
      if (existing) {
        clips.set(clipId, { ...existing, ...update } as Clip);
        set(clipsMapAtom, clips);
      }
    }
  )
);

// Derived atom for clip position (start + end time)
export const clipPositionAtomFamily = atomFamily((clipId: string) =>
  atom((get) => {
    const clip = get(clipAtomFamily(clipId));
    if (!clip) return null;
    return {
      start: clip.startTime,
      end: clip.startTime + clip.duration,
      duration: clip.duration,
    };
  })
);

// Derived atom for clips on a specific track
export const clipsOnTrackAtom = atomFamily((trackId: string) =>
  atom((get) => {
    const clips = get(clipsMapAtom);
    return Array.from(clips.values()).filter((clip) => clip.trackId === trackId);
  })
);

// Derived atom for clips within a time range (for virtualization)
export const clipsInTimeRangeAtom = atom((get) => {
  return (startTime: number, endTime: number) => {
    const clips = get(clipsMapAtom);
    return Array.from(clips.values()).filter(
      (clip) =>
        clip.startTime < endTime && clip.startTime + clip.duration > startTime
    );
  };
});

// Derived atom for selected clips
export const selectedClipsAtom = atom<string[]>([]);

export const isClipSelectedAtomFamily = atomFamily((clipId: string) =>
  atom((get) => get(selectedClipsAtom).includes(clipId))
);

// Atom for clip being dragged
export const draggedClipIdAtom = atom<string | null>(null);

// Atom for clip being trimmed
export const trimmedClipIdAtom = atom<string | null>(null);
export const trimSideAtom = atom<"left" | "right" | null>(null);

// Atom for hovered clip
export const hoveredClipIdAtom = atom<string | null>(null);

// Derived atom for total clips count
export const clipsCountAtom = atom((get) => get(clipsMapAtom).size);

// Derived atom for all clip IDs
export const clipIdsAtom = atom((get) => Array.from(get(clipsMapAtom).keys()));
