import type {
  ProjectMetadata,
  ProjectData,
  Project,
  PersistenceResult,
} from "../types";

/**
 * Abstract interface for persistence operations.
 * Implementations can be localStorage, Supabase, REST API, IndexedDB, etc.
 *
 * Design principles:
 * - All methods are async (even if localStorage is sync) for uniformity
 * - Returns Result types instead of throwing for predictable error handling
 * - Metadata and data operations are separate for efficiency
 */
export interface PersistenceAdapter {
  /**
   * Adapter identifier for debugging/logging
   */
  readonly name: string;

  /**
   * Check if the adapter is available/initialized
   */
  isAvailable(): Promise<boolean>;

  // ==================== Project List Operations ====================

  /**
   * Get list of all projects (metadata only, not full data)
   */
  listProjects(): Promise<PersistenceResult<ProjectMetadata[]>>;

  /**
   * Get the currently active project ID (if any)
   */
  getActiveProjectId(): Promise<PersistenceResult<string | null>>;

  /**
   * Set the active project ID
   */
  setActiveProjectId(id: string | null): Promise<PersistenceResult<void>>;

  // ==================== Single Project Operations ====================

  /**
   * Get full project data by ID
   */
  getProject(id: string): Promise<PersistenceResult<Project>>;

  /**
   * Get only project metadata by ID
   */
  getProjectMetadata(id: string): Promise<PersistenceResult<ProjectMetadata>>;

  /**
   * Get only project data by ID (without metadata)
   */
  getProjectData(id: string): Promise<PersistenceResult<ProjectData>>;

  /**
   * Create a new project
   */
  createProject(
    name: string,
    initialData?: Partial<ProjectData>
  ): Promise<PersistenceResult<Project>>;

  /**
   * Save project data (auto-save target)
   * Updates the 'updatedAt' timestamp automatically
   */
  saveProjectData(
    id: string,
    data: ProjectData
  ): Promise<PersistenceResult<void>>;

  /**
   * Update project metadata (rename, etc.)
   */
  updateProjectMetadata(
    id: string,
    updates: Partial<Pick<ProjectMetadata, "name" | "thumbnailUrl">>
  ): Promise<PersistenceResult<ProjectMetadata>>;

  /**
   * Delete a project
   */
  deleteProject(id: string): Promise<PersistenceResult<void>>;

  /**
   * Duplicate a project
   */
  duplicateProject(
    id: string,
    newName?: string
  ): Promise<PersistenceResult<Project>>;

  // ==================== Lifecycle ====================

  /**
   * Initialize the adapter (create tables, check storage, etc.)
   */
  initialize(): Promise<PersistenceResult<void>>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}
