import type { PersistenceAdapter } from "./adapters/PersistenceAdapter";
import type {
  Project,
  ProjectMetadata,
  ProjectData,
  PersistenceResult,
} from "./types";
import { LocalStorageAdapter } from "./adapters/LocalStorageAdapter";

/**
 * High-level project management service.
 * Wraps the adapter and provides additional functionality.
 *
 * This is designed to be a singleton or instantiated once at app level.
 */
export class ProjectManager {
  private adapter: PersistenceAdapter;
  private initialized = false;

  constructor(adapter?: PersistenceAdapter) {
    this.adapter = adapter ?? new LocalStorageAdapter();
  }

  /**
   * Initialize the project manager
   */
  async initialize(): Promise<PersistenceResult<void>> {
    if (this.initialized) {
      return { success: true, data: undefined };
    }

    const result = await this.adapter.initialize();
    if (result.success) {
      this.initialized = true;
    }
    return result;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get or create a default project for first-time users
   */
  async getOrCreateDefaultProject(): Promise<PersistenceResult<Project>> {
    const listResult = await this.adapter.listProjects();
    if (!listResult.success) {
      return listResult as PersistenceResult<Project>;
    }

    // If projects exist, get the active one or the first one
    if (listResult.data.length > 0) {
      const activeIdResult = await this.adapter.getActiveProjectId();
      const projectId =
        activeIdResult.success && activeIdResult.data
          ? activeIdResult.data
          : listResult.data[0].id;

      return this.adapter.getProject(projectId);
    }

    // Create default project
    return this.adapter.createProject("Untitled Project");
  }

  /**
   * Switch to a different project
   */
  async switchProject(id: string): Promise<PersistenceResult<Project>> {
    const projectResult = await this.adapter.getProject(id);
    if (!projectResult.success) {
      return projectResult;
    }

    await this.adapter.setActiveProjectId(id);
    return projectResult;
  }

  /**
   * List all projects sorted by updated date
   */
  listProjects(): Promise<PersistenceResult<ProjectMetadata[]>> {
    return this.adapter.listProjects();
  }

  /**
   * Get project by ID
   */
  getProject(id: string): Promise<PersistenceResult<Project>> {
    return this.adapter.getProject(id);
  }

  /**
   * Create a new project and set it as active
   */
  async createProject(
    name: string,
    initialData?: Partial<ProjectData>
  ): Promise<PersistenceResult<Project>> {
    const result = await this.adapter.createProject(name, initialData);
    if (result.success) {
      await this.adapter.setActiveProjectId(result.data.id);
    }
    return result;
  }

  /**
   * Delete a project
   */
  deleteProject(id: string): Promise<PersistenceResult<void>> {
    return this.adapter.deleteProject(id);
  }

  /**
   * Rename a project
   */
  renameProject(
    id: string,
    name: string
  ): Promise<PersistenceResult<ProjectMetadata>> {
    return this.adapter.updateProjectMetadata(id, { name });
  }

  /**
   * Duplicate a project
   */
  duplicateProject(
    id: string,
    newName?: string
  ): Promise<PersistenceResult<Project>> {
    return this.adapter.duplicateProject(id, newName);
  }

  /**
   * Save project data (used by auto-save)
   */
  saveProjectData(
    id: string,
    data: ProjectData
  ): Promise<PersistenceResult<void>> {
    return this.adapter.saveProjectData(id, data);
  }

  /**
   * Get the underlying adapter (for advanced use cases)
   */
  getAdapter(): PersistenceAdapter {
    return this.adapter;
  }

  /**
   * Swap the adapter (e.g., switch from localStorage to Supabase)
   */
  async setAdapter(
    adapter: PersistenceAdapter
  ): Promise<PersistenceResult<void>> {
    await this.adapter.dispose();
    this.adapter = adapter;
    this.initialized = false;
    return this.initialize();
  }
}

// Default singleton instance
export const projectManager = new ProjectManager();
