import { z } from "zod";
import { ClipSchema } from "./clip.schema";
import { TrackSchema } from "./track.schema";

export const ResolutionSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const TimelineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().default("Untitled Project"),
  fps: z.number().positive().default(30),
  resolution: ResolutionSchema.default({ width: 1920, height: 1080 }),
  duration: z.number().positive().default(60), // Total timeline duration in seconds
  tracks: z.array(TrackSchema),
  clips: z.array(ClipSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Resolution = z.infer<typeof ResolutionSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;

// Common resolution presets
export const RESOLUTION_PRESETS = {
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
  "4K": { width: 3840, height: 2160 },
  "Instagram Square": { width: 1080, height: 1080 },
  "Instagram Story": { width: 1080, height: 1920 },
  "TikTok": { width: 1080, height: 1920 },
  "YouTube Shorts": { width: 1080, height: 1920 },
} as const;

// Factory function for creating a new timeline
export function createTimeline(
  partial?: Partial<Omit<Timeline, "id" | "createdAt" | "updatedAt">>
): Timeline {
  const now = new Date();
  return TimelineSchema.parse({
    id: crypto.randomUUID(),
    name: "Untitled Project",
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    duration: 60,
    tracks: [],
    clips: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}

// Validation helpers
export function validateTimeline(data: unknown): Timeline {
  return TimelineSchema.parse(data);
}

export function safeValidateTimeline(
  data: unknown
): { success: true; data: Timeline } | { success: false; error: z.ZodError } {
  const result = TimelineSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
