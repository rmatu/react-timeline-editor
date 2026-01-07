import { atom } from "jotai";

// Scrub preview time (separate from playback time during trimming)
// This is transient UI state - the actual currentTime is in the Zustand store
export const scrubPreviewTimeAtom = atom<number | null>(null);

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
