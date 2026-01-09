import { useEffect, useState, useCallback } from "react";
import { useTimelineStore, type MediaItem } from "@/stores/timelineStore";
import { projectManager, mediaStorage, type Project } from "@/services/persistence";
import type { Clip } from "@/schemas";

interface UseProjectHydrationOptions {
  /** Skip loading if no project exists (won't create default) */
  skipDefaultCreation?: boolean;
}

interface UseProjectHydrationReturn {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  currentProject: Project | null;
  /** Reload the current project from storage */
  reload: () => Promise<void>;
  /** Load a specific project by ID */
  loadProject: (id: string) => Promise<void>;
  /** Create a new project */
  createProject: (name: string) => Promise<Project | null>;
  /** Update the current project metadata (e.g., name) */
  updateProjectName: (name: string) => void;
}

/**
 * Hook to hydrate the timeline store from persisted project data on app start.
 *
 * Flow:
 * 1. Initialize persistence adapter
 * 2. Get or create default project
 * 3. Load project data into timelineStore
 */
export function useProjectHydration(
  options: UseProjectHydrationOptions = {}
): UseProjectHydrationReturn {
  const { skipDefaultCreation = false } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const loadTimeline = useTimelineStore((s) => s.loadTimeline);
  const setDuration = useTimelineStore((s) => s.setDuration);
  const setFps = useTimelineStore((s) => s.setFps);
  const setResolution = useTimelineStore((s) => s.setResolution);

  const hydrateFromProject = useCallback(
    async (project: Project) => {
      const { data } = project;

      // Restore blob URLs from IndexedDB for media items with storageId
      const restoredMediaLibrary: MediaItem[] = [];
      const urlMapping = new Map<string, string>(); // old URL -> new blob URL

      for (const item of data.mediaLibrary) {
        if (item.storageId && (item.type === "video" || item.type === "audio")) {
          try {
            const stored = await mediaStorage.getMedia(item.storageId);
            if (stored) {
              // Map old URL to new blob URL (for updating clips)
              urlMapping.set(item.url, stored.url);
              restoredMediaLibrary.push({
                ...item,
                url: stored.url,
              });
              continue;
            }
          } catch (err) {
            console.warn(`Failed to restore media ${item.id} from IndexedDB:`, err);
          }
        }
        // Keep item as-is if no storageId or restoration failed
        restoredMediaLibrary.push(item);
      }

      // Update clip source URLs to use new blob URLs
      const restoredClips: Clip[] = data.clips.map((clip) => {
        if ("sourceUrl" in clip && typeof clip.sourceUrl === "string") {
          const newUrl = urlMapping.get(clip.sourceUrl);
          if (newUrl) {
            return { ...clip, sourceUrl: newUrl };
          }
        }
        return clip;
      });

      // Load tracks, clips, and media library
      loadTimeline(data.tracks, restoredClips, restoredMediaLibrary);

      // Set timeline configuration
      setDuration(data.duration);
      setFps(data.fps);
      setResolution(data.resolution.width, data.resolution.height);

      setCurrentProject(project);
    },
    [loadTimeline, setDuration, setFps, setResolution]
  );

  const loadProject = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        const result = await projectManager.switchProject(id);
        if (!result.success) {
          throw result.error;
        }
        await hydrateFromProject(result.data);
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateFromProject]
  );

  const createProject = useCallback(
    async (name: string): Promise<Project | null> => {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        const result = await projectManager.createProject(name);
        if (!result.success) {
          throw result.error;
        }
        await hydrateFromProject(result.data);
        return result.data;
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateFromProject]
  );

  const reload = useCallback(async () => {
    if (currentProject) {
      await loadProject(currentProject.id);
    }
  }, [currentProject, loadProject]);

  const updateProjectName = useCallback((name: string) => {
    if (currentProject) {
      setCurrentProject({
        ...currentProject,
        name,
      });
    }
  }, [currentProject]);

  // Initial hydration on mount
  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        // Initialize persistence
        const initResult = await projectManager.initialize();
        if (!initResult.success) {
          throw initResult.error;
        }

        if (skipDefaultCreation) {
          // Just check if there's an active project
          const listResult = await projectManager.listProjects();
          if (listResult.success && listResult.data.length > 0) {
            const projectResult =
              await projectManager.getOrCreateDefaultProject();
            if (projectResult.success && mounted) {
              await hydrateFromProject(projectResult.data);
            }
          }
          // If no projects, just finish loading without error
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        // Get or create project
        const projectResult = await projectManager.getOrCreateDefaultProject();
        if (!projectResult.success) {
          throw projectResult.error;
        }

        if (mounted) {
          await hydrateFromProject(projectResult.data);
        }
      } catch (err) {
        if (mounted) {
          setIsError(true);
          setError(err instanceof Error ? err : new Error(String(err)));
          console.warn("Failed to load project:", err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, [hydrateFromProject, skipDefaultCreation]);

  return {
    isLoading,
    isError,
    error,
    currentProject,
    reload,
    loadProject,
    createProject,
    updateProjectName,
  };
}
