// Timeline configuration constants

// Default zoom level in pixels per second
export const DEFAULT_ZOOM = 50;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 500;

// Track dimensions
export const DEFAULT_TRACK_HEIGHT = 60;
export const MIN_TRACK_HEIGHT = 40;
export const MAX_TRACK_HEIGHT = 120;
export const TRACK_HEADER_WIDTH = 150;

// Clip constraints
export const MIN_CLIP_DURATION = 0.1; // seconds
export const CLIP_BORDER_RADIUS = 4;

// Trim handle dimensions
export const TRIM_HANDLE_WIDTH = 12;
export const TRIM_HANDLE_HIT_AREA = 24; // 2x visual size for touch

// Snapping
export const SNAP_THRESHOLD_PX = 8;
export const SNAP_THRESHOLD_SECONDS = 0.1;

// Touch targets (iOS Human Interface Guidelines: 44pt minimum)
export const MIN_TOUCH_TARGET = 44;

// Time ruler
export const RULER_HEIGHT = 32;
export const RULER_LABEL_INTERVAL_THRESHOLDS = {
  HIGH_ZOOM: 100, // > 100px/s: 1s intervals
  MEDIUM_ZOOM: 30, // 30-100px/s: 5s intervals
  LOW_ZOOM: 10, // 10-30px/s: 10s intervals
  // < 10px/s: 30s intervals
};

// Playhead
export const PLAYHEAD_WIDTH = 2;
export const PLAYHEAD_HEAD_SIZE = 12;

// Animation durations (ms)
export const SNAP_ANIMATION_DURATION = 150;
export const SELECTION_ANIMATION_DURATION = 100;

// FPS options
export const COMMON_FPS = [24, 25, 30, 50, 60] as const;
export const DEFAULT_FPS = 30;

// Default timeline duration (seconds)
export const DEFAULT_DURATION = 60;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: " ",
  DELETE: ["Delete", "Backspace"],
  UNDO: "z",
  REDO: "y",
  SELECT_ALL: "a",
  DESELECT: "Escape",
  NUDGE_LEFT: "ArrowLeft",
  NUDGE_RIGHT: "ArrowRight",
  ZOOM_IN: "=",
  ZOOM_OUT: "-",
} as const;

// Colors for track types
export const TRACK_COLORS = {
  video: "#4a90d9",
  audio: "#50c878",
  text: "#ffa500",
  sticker: "#da70d6",
} as const;
