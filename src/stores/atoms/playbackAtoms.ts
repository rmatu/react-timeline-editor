import { atom } from "jotai";

// Current playback time in seconds
export const currentTimeAtom = atom<number>(0);

// Playing state
export const isPlayingAtom = atom<boolean>(false);

// Playback rate (1 = normal speed)
export const playbackRateAtom = atom<number>(1);

// Loop state
export const loopEnabledAtom = atom<boolean>(false);
export const loopStartAtom = atom<number | null>(null);
export const loopEndAtom = atom<number | null>(null);

// Derived atom for formatted current time
export const formattedCurrentTimeAtom = atom((get) => {
  const time = get(currentTimeAtom);
  return formatTime(time);
});

// Derived atom for loop range
export const loopRangeAtom = atom((get) => {
  const enabled = get(loopEnabledAtom);
  if (!enabled) return null;

  const start = get(loopStartAtom);
  const end = get(loopEndAtom);

  if (start === null || end === null) return null;

  return { start, end };
});

// Scrub preview time (separate from playback time during trimming)
export const scrubPreviewTimeAtom = atom<number | null>(null);

// Display time (shows scrub preview when active, otherwise current time)
export const displayTimeAtom = atom((get) => {
  const scrubTime = get(scrubPreviewTimeAtom);
  if (scrubTime !== null) {
    return scrubTime;
  }
  return get(currentTimeAtom);
});

// Helper function to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Show decimal for times under 10 seconds
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${secs}s`;
}

// Format time as timecode (MM:SS:FF)
export function formatTimecode(seconds: number, fps: number = 30): string {
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60);

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

// Format time for ruler labels
export function formatRulerTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (secs === 0) {
    return `${mins}:00`;
  }

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
