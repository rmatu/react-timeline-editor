import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { Track } from "@/schemas";

// Base atom for all tracks - synced with Zustand store
export const tracksMapAtom = atom<Map<string, Track>>(new Map());

// Atom family for individual track access
export const trackAtomFamily = atomFamily((trackId: string) =>
  atom(
    (get) => get(tracksMapAtom).get(trackId),
    (get, set, update: Partial<Track>) => {
      const tracks = new Map(get(tracksMapAtom));
      const existing = tracks.get(trackId);
      if (existing) {
        tracks.set(trackId, { ...existing, ...update });
        set(tracksMapAtom, tracks);
      }
    }
  )
);

// Derived atom for sorted tracks (by order)
export const sortedTracksAtom = atom((get) => {
  const tracks = get(tracksMapAtom);
  return Array.from(tracks.values()).sort((a, b) => a.order - b.order);
});

// Derived atom for track IDs in order
export const sortedTrackIdsAtom = atom((get) => {
  return get(sortedTracksAtom).map((track) => track.id);
});

// Derived atom for tracks count
export const tracksCountAtom = atom((get) => get(tracksMapAtom).size);

// Derived atom for tracks by type
export const tracksByTypeAtom = atomFamily((type: Track["type"]) =>
  atom((get) => {
    const tracks = get(tracksMapAtom);
    return Array.from(tracks.values()).filter((track) => track.type === type);
  })
);

// Atom for selected track
export const selectedTrackIdAtom = atom<string | null>(null);

export const isTrackSelectedAtomFamily = atomFamily((trackId: string) =>
  atom((get) => get(selectedTrackIdAtom) === trackId)
);

// Atom for hovered track
export const hoveredTrackIdAtom = atom<string | null>(null);

// Derived atom for total tracks height
export const totalTracksHeightAtom = atom((get) => {
  const tracks = get(sortedTracksAtom);
  return tracks.reduce((sum, track) => sum + track.height, 0);
});

// Derived atom for track vertical position
export const trackVerticalPositionAtomFamily = atomFamily((trackId: string) =>
  atom((get) => {
    const tracks = get(sortedTracksAtom);
    let position = 0;
    for (const track of tracks) {
      if (track.id === trackId) {
        return position;
      }
      position += track.height;
    }
    return position;
  })
);
