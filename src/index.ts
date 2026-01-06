// Main components
export { Timeline } from "./components/timeline";
export { VideoPreview, PreviewControls } from "./components/preview";

// Individual timeline components (for custom compositions)
export {
  TimelineViewport,
  TimeRuler,
  Playhead,
  Track,
  TrackHeader,
  Clip,
  ClipContent,
  TrimHandle,
  GhostOutline,
  SnapGuide,
} from "./components/timeline";

// Hooks
export {
  useTimelineGestures,
  useClipDrag,
  useClipTrim,
  useKeyboardShortcuts,
  useSnapping,
  usePlayhead,
  useZoom,
} from "./hooks";

// Stores
export {
  useTimelineStore,
  useZoomLevel,
  useCurrentTime,
  useIsPlaying,
  useSelectedClipIds,
  useTracks,
  useClips,
} from "./stores";

// Jotai atoms (for advanced usage)
export {
  clipsMapAtom,
  clipAtomFamily,
  tracksMapAtom,
  trackAtomFamily,
  currentTimeAtom,
  isPlayingAtom,
} from "./stores";

export { snapGuideAtom } from "./components/timeline/SnapGuide";

// Schemas and validators
export {
  ClipSchema,
  VideoClipSchema,
  AudioClipSchema,
  TextClipSchema,
  StickerClipSchema,
  TrackSchema,
  TimelineSchema,
  validateClip,
  safeValidateClip,
  validateTrack,
  safeValidateTrack,
  validateTimeline,
  safeValidateTimeline,
  createTrack,
  createTimeline,
  getClipEndTime,
  hasFiniteDuration,
  RESOLUTION_PRESETS,
} from "./schemas";

// Types - renamed to avoid conflicts with components
export type {
  Clip as ClipData,
  VideoClip as VideoClipData,
  AudioClip as AudioClipData,
  TextClip as TextClipData,
  StickerClip as StickerClipData,
  ClipType,
  Track as TrackData,
  TrackType,
  Timeline as TimelineData,
  Resolution,
  TimelineProps,
  VideoPreviewProps,
  SnapPoint,
  SnapResult,
  TimeRange,
  GestureType,
  TrimSide,
} from "./types";

// Utilities
export {
  timeToPixels,
  pixelsToTime,
  formatTimecode,
  formatDuration,
  formatRulerLabel,
  calculateRulerInterval,
  getVisibleTimeRange,
  generateSnapPoints,
  findNearestSnapPoint,
  snapClipPosition,
  calculateSnapThreshold,
  getClipBounds,
  isClipVisible,
  getVisibleClips,
} from "./utils";

// Constants
export {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_TRACK_HEIGHT,
  TRACK_HEADER_WIDTH,
  RULER_HEIGHT,
  SNAP_THRESHOLD_PX,
  MIN_CLIP_DURATION,
  MIN_TOUCH_TARGET,
  KEYBOARD_SHORTCUTS,
  TRACK_COLORS,
  COMMON_FPS,
  DEFAULT_FPS,
  DEFAULT_DURATION,
} from "./constants/timeline.constants";
