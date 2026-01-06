export {
  ClipSchema,
  VideoClipSchema,
  AudioClipSchema,
  TextClipSchema,
  StickerClipSchema,
  validateClip,
  safeValidateClip,
  getClipEndTime,
  hasFiniteDuration,
} from "./clip.schema";
export type {
  Clip,
  VideoClip,
  AudioClip,
  TextClip,
  StickerClip,
  ClipType,
} from "./clip.schema";

export {
  TrackSchema,
  TrackTypeSchema,
  validateTrack,
  safeValidateTrack,
  createTrack,
} from "./track.schema";
export type { Track, TrackType } from "./track.schema";

export {
  TimelineSchema,
  ResolutionSchema,
  validateTimeline,
  safeValidateTimeline,
  createTimeline,
  RESOLUTION_PRESETS,
} from "./timeline.schema";
export type { Timeline, Resolution } from "./timeline.schema";
