import { z } from "zod";

export const TrackTypeSchema = z.enum(["video", "audio", "text", "sticker"]);

export const TrackSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: TrackTypeSchema,
  order: z.number().int().min(0), // Vertical position (0 = top)
  height: z.number().positive().default(60),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false), // Only this track plays audio
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(), // Custom track color
});

export type Track = z.infer<typeof TrackSchema>;
export type TrackType = z.infer<typeof TrackTypeSchema>;

// Validation helpers
export function validateTrack(data: unknown): Track {
  return TrackSchema.parse(data);
}

export function safeValidateTrack(
  data: unknown
): { success: true; data: Track } | { success: false; error: z.ZodError } {
  const result = TrackSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Factory function for creating tracks
export function createTrack(
  partial: Partial<Track> & { name: string; type: TrackType }
): Track {
  return TrackSchema.parse({
    id: crypto.randomUUID(),
    order: 0,
    height: 60,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    ...partial,
  });
}
