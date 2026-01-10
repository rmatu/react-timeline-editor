import { useEffect, useState, useCallback, useRef } from "react";
import { useTimelineStore, type MediaItem } from "@/stores/timelineStore";
import { projectManager, mediaStorage, type Project } from "@/services/persistence";
import type { Clip } from "@/schemas";

/**
 * Extract metadata from an image URL (dimensions, thumbnail, animation status)
 */
async function extractImageMetadata(url: string): Promise<{
  dimensions: { width: number; height: number };
  isAnimated: boolean;
  thumbnailUrl?: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Create thumbnail
      const canvas = document.createElement('canvas');
      const maxThumbSize = 80;
      const scale = Math.min(maxThumbSize / img.width, maxThumbSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      let thumbnailUrl: string | undefined;
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
      }

      // Check if GIF (likely animated)
      const isAnimated = url.includes('.gif') || (img as HTMLImageElement).src.includes('image/gif');

      resolve({
        dimensions: { width: img.width, height: img.height },
        isAnimated,
        thumbnailUrl,
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

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

  // Track blob URLs created during hydration for cleanup
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  const loadTimeline = useTimelineStore((s) => s.loadTimeline);
  const setDuration = useTimelineStore((s) => s.setDuration);
  const setFps = useTimelineStore((s) => s.setFps);
  const setResolution = useTimelineStore((s) => s.setResolution);

  /**
   * Revoke all tracked blob URLs to prevent memory leaks.
   * Called when switching projects or unmounting.
   */
  const cleanupBlobUrls = useCallback(() => {
    for (const url of createdBlobUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore errors from already-revoked URLs
      }
    }
    createdBlobUrlsRef.current.clear();
  }, []);

  const hydrateFromProject = useCallback(
    async (project: Project) => {
      const { data } = project;

      // Clean up blob URLs from previous project before creating new ones
      cleanupBlobUrls();

      // Restore blob URLs from IndexedDB for media items with storageId
      const restoredMediaLibrary: MediaItem[] = [];
      const urlMapping = new Map<string, string>(); // old URL -> new blob URL

      for (const item of data.mediaLibrary) {
        if (item.storageId && (item.type === "video" || item.type === "audio" || item.type === "image")) {
          try {
            const stored = await mediaStorage.getMedia(item.storageId);
            if (stored) {
              // Map old URL to new blob URL (for updating clips)
              urlMapping.set(item.url, stored.url);
              // Track the new blob URL for cleanup
              createdBlobUrlsRef.current.add(stored.url);
              // Revoke old blob URL if it exists (from previous session)
              if (item.url.startsWith("blob:")) {
                try {
                  URL.revokeObjectURL(item.url);
                } catch {
                  // Ignore - URL may already be invalid
                }
              }

              // For images without dimensions, regenerate from blob
              let restoredItem = { ...item, url: stored.url };
              if (item.type === "image" && !item.dimensions) {
                try {
                  const imageData = await extractImageMetadata(stored.url);
                  restoredItem = {
                    ...restoredItem,
                    dimensions: imageData.dimensions,
                    isAnimated: imageData.isAnimated,
                    thumbnailUrl: imageData.thumbnailUrl || item.thumbnailUrl,
                  };
                } catch {
                  // Continue without dimensions if extraction fails
                }
              }

              restoredMediaLibrary.push(restoredItem);
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
        // Handle video/audio clips with sourceUrl
        if ("sourceUrl" in clip && typeof clip.sourceUrl === "string") {
          const newUrl = urlMapping.get(clip.sourceUrl);
          if (newUrl) {
            return { ...clip, sourceUrl: newUrl };
          }
        }
        // Handle sticker clips with assetUrl
        if ("assetUrl" in clip && typeof clip.assetUrl === "string") {
          const newUrl = urlMapping.get(clip.assetUrl);
          if (newUrl) {
            return { ...clip, assetUrl: newUrl };
          }
        }
        return clip;
      });

      // Load tracks, clips, and media library
      loadTimeline(data.tracks, restoredClips, restoredMediaLibrary, data.canvasBackground);

      // Set timeline configuration
      setDuration(data.duration);
      setFps(data.fps);
      setResolution(data.resolution.width, data.resolution.height);

      setCurrentProject(project);
    },
    [loadTimeline, setDuration, setFps, setResolution, cleanupBlobUrls]
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
      // Clean up blob URLs when component unmounts
      cleanupBlobUrls();
    };
  }, [hydrateFromProject, skipDefaultCreation, cleanupBlobUrls]);

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
