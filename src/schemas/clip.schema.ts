import { z } from "zod";
import { KeyframeSchema } from "./keyframe.schema";

// Base clip schema with common properties
const BaseClipSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  startTime: z.number().min(0), // Start position on timeline in seconds
  duration: z.number().positive(), // Duration in seconds
  sourceStartTime: z.number().min(0).default(0), // Offset into source media
  maxDuration: z.number().positive().optional(), // Maximum duration (for ghost outline)
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  keyframes: z.array(KeyframeSchema).optional(), // Animation keyframes (optional, defaults to [])
});

// Video clip schema
export const VideoClipSchema = BaseClipSchema.extend({
  type: z.literal("video"),
  sourceUrl: z.string(), // Can be blob URL or http URL
  name: z.string().optional(), // Original filename for display
  thumbnailUrl: z.string().optional(),
  thumbnails: z.array(z.string()).optional(), // Array of thumbnail URLs for strip
  volume: z.number().min(0).max(1).default(1),
  playbackRate: z.number().positive().default(1),
});

// Audio clip schema
export const AudioClipSchema = BaseClipSchema.extend({
  type: z.literal("audio"),
  sourceUrl: z.string(), // Can be blob URL or http URL
  name: z.string().optional(), // Original filename for display
  waveformData: z.array(z.number().min(0).max(1)).optional(), // Normalized amplitude data
  volume: z.number().min(0).max(1).default(1),
  fadeIn: z.number().min(0).default(0), // Fade duration in seconds
  fadeOut: z.number().min(0).default(0),
});

// Text clip schema
export const TextClipSchema = BaseClipSchema.extend({
  type: z.literal("text"),
  content: z.string(),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().positive().default(24),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#ffffff"),
  backgroundColor: z
    .string()
    .regex(/^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?|transparent|rgba?\([^)]+\))$/)
    .optional(),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  position: z
    .object({
      x: z.number().min(0).max(100), // Percentage
      y: z.number().min(0).max(100),
    })
    .default({ x: 50, y: 50 }),
  animation: z
    .enum(["none", "fade", "slide", "typewriter"])
    .optional()
    .default("none"),
  // Transform properties (base values, can be overridden by keyframes)
  scale: z.number().positive().default(1),
  rotation: z.number().default(0), // Degrees
  opacity: z.number().min(0).max(1).default(1),
  maxWidth: z.number().positive().optional(), // Max width in pixels for text wrapping
});

// Sticker/effect clip schema
export const StickerClipSchema = BaseClipSchema.extend({
  type: z.literal("sticker"),
  assetId: z.string(),
  assetUrl: z.string().url(),
  scale: z.number().positive().default(1),
  rotation: z.number().default(0), // Degrees
  opacity: z.number().min(0).max(1).default(1),
  position: z
    .object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    })
    .default({ x: 50, y: 50 }),
});

// Union of all clip types
export const ClipSchema = z.discriminatedUnion("type", [
  VideoClipSchema,
  AudioClipSchema,
  TextClipSchema,
  StickerClipSchema,
]);

// Infer types from schemas
export type VideoClip = z.infer<typeof VideoClipSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type TextClip = z.infer<typeof TextClipSchema>;
export type StickerClip = z.infer<typeof StickerClipSchema>;
export type Clip = z.infer<typeof ClipSchema>;

// Clip type discriminator
export type ClipType = Clip["type"];

// Helper to get clip end time
export function getClipEndTime(clip: Clip): number {
  return clip.startTime + clip.duration;
}

// Helper to check if clip has finite duration (video/audio vs text/sticker)
export function hasFiniteDuration(clip: Clip): boolean {
  return clip.type === "video" || clip.type === "audio";
}

// Validation helper
export function validateClip(data: unknown): Clip {
  return ClipSchema.parse(data);
}

export function safeValidateClip(
  data: unknown
): { success: true; data: Clip } | { success: false; error: z.ZodError } {
  const result = ClipSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
