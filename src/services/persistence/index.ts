// Adapters
export { LocalStorageAdapter } from "./adapters/LocalStorageAdapter";
export { SupabaseAdapter } from "./adapters/SupabaseAdapter";
export type { PersistenceAdapter } from "./adapters/PersistenceAdapter";

// Types
export type {
  ProjectMetadata,
  ProjectData,
  Project,
  StoredProjectList,
  PersistenceResult,
  PersistenceEvent,
  PersistenceEventType,
} from "./types";

// Manager
export { ProjectManager, projectManager } from "./ProjectManager";

// Constants
export { STORAGE_KEYS, AUTO_SAVE_CONFIG, DEFAULT_PROJECT } from "./constants";

// Media Storage (IndexedDB)
export { mediaStorage } from "./MediaStorage";
