import type { PersistenceAdapter } from "./PersistenceAdapter";
import type {
  ProjectMetadata,
  ProjectData,
  Project,
  PersistenceResult,
  StoredProjectList,
} from "../types";
import {
  validateProjectData,
  safeValidateProjectList,
} from "@/schemas/project.schema";
import { STORAGE_KEYS, DEFAULT_PROJECT } from "../constants";

/**
 * localStorage implementation of PersistenceAdapter
 *
 * Storage structure:
 * - video-timeline:projects -> StoredProjectList (metadata + active ID)
 * - video-timeline:project:{id} -> ProjectData (actual timeline data)
 */
export class LocalStorageAdapter implements PersistenceAdapter {
  readonly name = "localStorage";

  async isAvailable(): Promise<boolean> {
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<PersistenceResult<void>> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          success: false,
          error: new Error("localStorage is not available"),
        };
      }

      // Initialize project list if not exists
      const existingList = localStorage.getItem(STORAGE_KEYS.PROJECT_LIST);
      if (!existingList) {
        const initialList: StoredProjectList = {
          version: STORAGE_KEYS.SCHEMA_VERSION,
          projects: [],
          activeProjectId: null,
        };
        localStorage.setItem(
          STORAGE_KEYS.PROJECT_LIST,
          JSON.stringify(initialList)
        );
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async dispose(): Promise<void> {
    // No cleanup needed for localStorage
  }

  // ==================== Private Helpers ====================

  private getProjectList(): StoredProjectList {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECT_LIST);
    if (!raw) {
      return {
        version: STORAGE_KEYS.SCHEMA_VERSION,
        projects: [],
        activeProjectId: null,
      };
    }
    const result = safeValidateProjectList(JSON.parse(raw));
    if (result.success) {
      return result.data;
    }
    // If validation fails, return empty list (corrupted data)
    console.warn("Corrupted project list in localStorage, resetting");
    return {
      version: STORAGE_KEYS.SCHEMA_VERSION,
      projects: [],
      activeProjectId: null,
    };
  }

  private saveProjectList(list: StoredProjectList): void {
    localStorage.setItem(STORAGE_KEYS.PROJECT_LIST, JSON.stringify(list));
  }

  private getProjectDataKey(id: string): string {
    return `${STORAGE_KEYS.PROJECT_DATA_PREFIX}${id}`;
  }

  // ==================== Project List Operations ====================

  async listProjects(): Promise<PersistenceResult<ProjectMetadata[]>> {
    try {
      const list = this.getProjectList();
      // Sort by updatedAt descending (most recent first)
      const sorted = [...list.projects].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return { success: true, data: sorted };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getActiveProjectId(): Promise<PersistenceResult<string | null>> {
    try {
      const list = this.getProjectList();
      return { success: true, data: list.activeProjectId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async setActiveProjectId(
    id: string | null
  ): Promise<PersistenceResult<void>> {
    try {
      const list = this.getProjectList();
      list.activeProjectId = id;
      this.saveProjectList(list);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ==================== Single Project Operations ====================

  async getProject(id: string): Promise<PersistenceResult<Project>> {
    try {
      const list = this.getProjectList();
      const metadata = list.projects.find((p) => p.id === id);
      if (!metadata) {
        return {
          success: false,
          error: new Error(`Project not found: ${id}`),
        };
      }

      const dataResult = await this.getProjectData(id);
      if (!dataResult.success) {
        return dataResult;
      }

      const project: Project = {
        ...metadata,
        data: dataResult.data,
      };

      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getProjectMetadata(
    id: string
  ): Promise<PersistenceResult<ProjectMetadata>> {
    try {
      const list = this.getProjectList();
      const metadata = list.projects.find((p) => p.id === id);
      if (!metadata) {
        return {
          success: false,
          error: new Error(`Project not found: ${id}`),
        };
      }
      return { success: true, data: metadata };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getProjectData(id: string): Promise<PersistenceResult<ProjectData>> {
    try {
      const raw = localStorage.getItem(this.getProjectDataKey(id));
      if (!raw) {
        return {
          success: false,
          error: new Error(`Project data not found: ${id}`),
        };
      }
      const data = validateProjectData(JSON.parse(raw));
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async createProject(
    name: string,
    initialData?: Partial<ProjectData>
  ): Promise<PersistenceResult<Project>> {
    try {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const metadata: ProjectMetadata = {
        id,
        name,
        createdAt: now,
        updatedAt: now,
      };

      const data: ProjectData = {
        fps: DEFAULT_PROJECT.FPS,
        duration: DEFAULT_PROJECT.DURATION,
        resolution: { ...DEFAULT_PROJECT.RESOLUTION },
        tracks: [],
        clips: [],
        mediaLibrary: [],
        ...initialData,
      };

      // Save data first
      localStorage.setItem(this.getProjectDataKey(id), JSON.stringify(data));

      // Update project list
      const list = this.getProjectList();
      list.projects.push(metadata);
      list.activeProjectId = id;
      this.saveProjectList(list);

      const project: Project = { ...metadata, data };
      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async saveProjectData(
    id: string,
    data: ProjectData
  ): Promise<PersistenceResult<void>> {
    try {
      // Validate data before saving
      const validated = validateProjectData(data);

      // Save project data
      localStorage.setItem(
        this.getProjectDataKey(id),
        JSON.stringify(validated)
      );

      // Update updatedAt in metadata
      const list = this.getProjectList();
      const projectIndex = list.projects.findIndex((p) => p.id === id);
      if (projectIndex === -1) {
        return {
          success: false,
          error: new Error(`Project not found: ${id}`),
        };
      }

      list.projects[projectIndex].updatedAt = new Date().toISOString();
      this.saveProjectList(list);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async updateProjectMetadata(
    id: string,
    updates: Partial<Pick<ProjectMetadata, "name" | "thumbnailUrl">>
  ): Promise<PersistenceResult<ProjectMetadata>> {
    try {
      const list = this.getProjectList();
      const projectIndex = list.projects.findIndex((p) => p.id === id);
      if (projectIndex === -1) {
        return {
          success: false,
          error: new Error(`Project not found: ${id}`),
        };
      }

      const updated: ProjectMetadata = {
        ...list.projects[projectIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      list.projects[projectIndex] = updated;
      this.saveProjectList(list);

      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async deleteProject(id: string): Promise<PersistenceResult<void>> {
    try {
      // Remove project data
      localStorage.removeItem(this.getProjectDataKey(id));

      // Update project list
      const list = this.getProjectList();
      list.projects = list.projects.filter((p) => p.id !== id);

      // Clear active if deleted
      if (list.activeProjectId === id) {
        list.activeProjectId = list.projects[0]?.id ?? null;
      }

      this.saveProjectList(list);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async duplicateProject(
    id: string,
    newName?: string
  ): Promise<PersistenceResult<Project>> {
    try {
      const projectResult = await this.getProject(id);
      if (!projectResult.success) {
        return projectResult;
      }

      const original = projectResult.data;
      const name = newName ?? `${original.name} (Copy)`;

      return this.createProject(name, original.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
