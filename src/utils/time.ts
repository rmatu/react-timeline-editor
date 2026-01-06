/**
 * Convert time in seconds to pixel position
 */
export function timeToPixels(time: number, zoomLevel: number): number {
  return time * zoomLevel;
}

/**
 * Convert pixel position to time in seconds
 */
export function pixelsToTime(pixels: number, zoomLevel: number): number {
  return pixels / zoomLevel;
}

/**
 * Convert frame number to time in seconds
 */
export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

/**
 * Convert time in seconds to frame number
 */
export function timeToFrame(time: number, fps: number): number {
  return Math.floor(time * fps);
}

/**
 * Round time to nearest frame
 */
export function snapToFrame(time: number, fps: number): number {
  return Math.round(time * fps) / fps;
}

/**
 * Format time as duration string (e.g., "4.2s" or "1:30")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format time for ruler labels (adaptive format)
 */
export function formatRulerLabel(seconds: number): string {
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

/**
 * Format time as full timecode (MM:SS:FF)
 */
export function formatTimecode(seconds: number, fps: number = 30): string {
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60);
  const hours = Math.floor(mins / 60);

  if (hours > 0) {
    return `${hours}:${(mins % 60).toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

/**
 * Parse timecode string to seconds
 */
export function parseTimecode(timecode: string, fps: number = 30): number {
  const parts = timecode.split(":").map(Number);

  if (parts.length === 4) {
    // HH:MM:SS:FF
    const [hours, mins, secs, frames] = parts;
    return hours * 3600 + mins * 60 + secs + frames / fps;
  } else if (parts.length === 3) {
    // MM:SS:FF
    const [mins, secs, frames] = parts;
    return mins * 60 + secs + frames / fps;
  } else if (parts.length === 2) {
    // MM:SS
    const [mins, secs] = parts;
    return mins * 60 + secs;
  }

  return parseFloat(timecode) || 0;
}

/**
 * Calculate ruler interval based on zoom level
 */
export interface RulerInterval {
  majorInterval: number; // Seconds between major ticks
  minorDivisions: number; // Number of minor ticks between major ticks
  format: "seconds" | "minutes";
}

export function calculateRulerInterval(
  pixelsPerSecond: number
): RulerInterval {
  if (pixelsPerSecond > 100) {
    return { majorInterval: 1, minorDivisions: 4, format: "seconds" };
  } else if (pixelsPerSecond > 30) {
    return { majorInterval: 5, minorDivisions: 5, format: "seconds" };
  } else if (pixelsPerSecond > 10) {
    return { majorInterval: 10, minorDivisions: 10, format: "seconds" };
  } else if (pixelsPerSecond > 3) {
    return { majorInterval: 30, minorDivisions: 6, format: "minutes" };
  } else {
    return { majorInterval: 60, minorDivisions: 4, format: "minutes" };
  }
}

/**
 * Get visible time range based on scroll and viewport
 */
export function getVisibleTimeRange(
  scrollX: number,
  viewportWidth: number,
  zoomLevel: number
): { startTime: number; endTime: number } {
  const startTime = pixelsToTime(scrollX, zoomLevel);
  const endTime = pixelsToTime(scrollX + viewportWidth, zoomLevel);
  return { startTime, endTime };
}

/**
 * Clamp time to valid range
 */
export function clampTime(
  time: number,
  min: number = 0,
  max: number = Infinity
): number {
  return Math.max(min, Math.min(max, time));
}
