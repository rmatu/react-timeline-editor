export {
  timeToPixels,
  pixelsToTime,
  frameToTime,
  timeToFrame,
  snapToFrame,
  formatDuration,
  formatRulerLabel,
  formatTimecode,
  parseTimecode,
  calculateRulerInterval,
  getVisibleTimeRange,
  clampTime,
  type RulerInterval,
} from "./time";

export {
  doRangesOverlap,
  getClipBounds,
  isPointInClip,
  getTimeAtPosition,
  getPositionForTime,
  isClipVisible,
  getVisibleClips,
  calculateZoomCenteredScroll,
  constrainScroll,
  getTrackAtPosition,
  distance,
  isPointInRect,
  getClipsBoundingBox,
} from "./geometry";

export {
  generateSnapPoints,
  findNearestSnapPoint,
  snapClipPosition,
  snapTrimPosition,
  calculateSnapThreshold,
  wouldClipsOverlap,
  findNearestGap,
} from "./snapping";

export {
  getTransitionState,
  isInTransition,
  getEffectiveClipDuration,
  getTransitionTransform,
  applyTransitionToContext,
  transitionTransformToCSS,
  findAdjacentClips,
  getMaxTransitionDuration,
} from "./transitions";
export type { TransitionState, TransitionTransform } from "./transitions";

// Export utilities
export { RenderEngine, exportToMp4 } from "./export";
export type { RenderContext, VideoResources, RenderEngineOptions, ExportOptions } from "./export";
