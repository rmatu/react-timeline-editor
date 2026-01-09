import type { Track, Clip } from "@/schemas";
import type { MediaItem } from "@/stores/timelineStore";

/**
 * Project metadata - stored separately from timeline data
 * for efficient listing without loading full project
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string; // ISO 8601 string for JSON serialization
  updatedAt: string; // ISO 8601 string
  thumbnailUrl?: string; // Optional preview thumbnail
}

/**
 * Timeline data - the actual content of a project
 * Matches TimelineExport + mediaLibrary
 */
export interface ProjectData {
  fps: number;
  duration: number;
  resolution: { width: number; height: number };
  tracks: Track[];
  clips: Clip[];
  mediaLibrary: MediaItem[];
}

/**
 * Full project = metadata + data
 */
export interface Project extends ProjectMetadata {
  data: ProjectData;
}

/**
 * What we store: metadata list + individual project data
 */
export interface StoredProjectList {
  version: number; // Schema version for migrations
  projects: ProjectMetadata[];
  activeProjectId: string | null;
}

/**
 * Result type for async operations - provides predictable error handling
 */
export type PersistenceResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Event types for persistence operations (for future observability)
 */
export type PersistenceEventType =
  | "save:start"
  | "save:success"
  | "save:error"
  | "load:start"
  | "load:success"
  | "load:error";

export interface PersistenceEvent {
  type: PersistenceEventType;
  projectId?: string;
  error?: Error;
  timestamp: number;
}
