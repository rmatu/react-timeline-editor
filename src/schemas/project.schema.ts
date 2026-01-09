import { z } from "zod";
import { ClipSchema } from "./clip.schema";
import { TrackSchema } from "./track.schema";
import { ResolutionSchema } from "./timeline.schema";

/**
 * Schema for subtitle entries (for SRT files)
 */
export const SubtitleSchema = z.object({
  index: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  text: z.string(),
});

/**
 * Schema for MediaItem (mirrors timelineStore's MediaItem interface)
 */
export const MediaItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["video", "audio", "srt", "image"]),
  url: z.string(),
  duration: z.number().optional(),
  thumbnailUrl: z.string().optional(),
  storageId: z.string().optional(), // Reference to IndexedDB storage
  subtitles: z.array(SubtitleSchema).optional(),
  // Image-specific properties
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  isAnimated: z.boolean().optional(),
});

/**
 * Schema for project metadata
 */
export const ProjectMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  thumbnailUrl: z.string().optional(),
});

/**
 * Schema for project data (timeline content)
 */
export const ProjectDataSchema = z.object({
  fps: z.number().positive().default(30),
  duration: z.number().positive().default(60),
  resolution: ResolutionSchema.default({ width: 1920, height: 1080 }),
  tracks: z.array(TrackSchema).default([]),
  clips: z.array(ClipSchema).default([]),
  mediaLibrary: z.array(MediaItemSchema).default([]),
});

/**
 * Full project schema
 */
export const ProjectSchema = ProjectMetadataSchema.extend({
  data: ProjectDataSchema,
});

/**
 * Schema for stored project list
 */
export const StoredProjectListSchema = z.object({
  version: z.number().default(1),
  projects: z.array(ProjectMetadataSchema).default([]),
  activeProjectId: z.string().uuid().nullable().default(null),
});

// Type exports
export type Subtitle = z.infer<typeof SubtitleSchema>;
export type MediaItemStored = z.infer<typeof MediaItemSchema>;
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type ProjectData = z.infer<typeof ProjectDataSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type StoredProjectList = z.infer<typeof StoredProjectListSchema>;

// Validation helpers
export function validateProject(data: unknown): Project {
  return ProjectSchema.parse(data);
}

export function validateProjectData(data: unknown): ProjectData {
  return ProjectDataSchema.parse(data);
}

export function validateProjectMetadata(data: unknown): ProjectMetadata {
  return ProjectMetadataSchema.parse(data);
}

export function validateProjectList(data: unknown): StoredProjectList {
  return StoredProjectListSchema.parse(data);
}

export function safeValidateProjectData(
  data: unknown
): { success: true; data: ProjectData } | { success: false; error: z.ZodError } {
  const result = ProjectDataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeValidateProjectList(
  data: unknown
): { success: true; data: StoredProjectList } | { success: false; error: z.ZodError } {
  const result = StoredProjectListSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
