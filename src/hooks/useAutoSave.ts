import { useEffect, useRef, useCallback, useState } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { PersistenceAdapter, ProjectData } from "@/services/persistence";
import {
  AUTO_SAVE_CONFIG,
  STORAGE_KEYS,
} from "@/services/persistence/constants";

interface UseAutoSaveOptions {
  adapter: PersistenceAdapter;
  projectId: string | null;
  enabled?: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveNow: () => Promise<void>;
  hasPendingChanges: boolean;
}

/**
 * Hook for auto-saving timeline state with debouncing.
 *
 * Behavior:
 * - Watches relevant timelineStore state (tracks, clips, mediaLibrary, fps, duration, resolution)
 * - Debounces saves by 2 seconds (configurable)
 * - Forces save after 10 seconds of continuous changes
 * - Does NOT trigger on transient state (currentTime, isPlaying, selection, etc.)
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const {
    adapter,
    projectId,
    enabled = true,
    debounceMs = AUTO_SAVE_CONFIG.DEBOUNCE_MS,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Refs for debounce control
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);

  // Get state selector for persistable data only
  const getPersistableState = useCallback((): ProjectData => {
    const state = useTimelineStore.getState();
    return {
      fps: state.fps,
      duration: state.totalDuration,
      resolution: state.resolution,
      tracks: Array.from(state.tracks.values()),
      clips: Array.from(state.clips.values()),
      mediaLibrary: Array.from(state.mediaLibrary.values()),
      canvasBackground: state.canvasBackground,
    };
  }, []);

  // Core save function
  const performSave = useCallback(async () => {
    if (!projectId || !enabled) return;

    const data = getPersistableState();
    const serialized = JSON.stringify(data);

    // Skip if nothing changed since last save
    if (serialized === lastSavedDataRef.current) {
      setHasPendingChanges(false);
      return;
    }

    setIsSaving(true);
    onSaveStart?.();

    try {
      const result = await adapter.saveProjectData(projectId, data);

      if (result.success) {
        lastSavedDataRef.current = serialized;
        setLastSavedAt(new Date());
        setHasPendingChanges(false);
        onSaveSuccess?.();
      } else {
        throw result.error;
      }
    } catch (error) {
      onSaveError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSaving(false);
    }
  }, [
    adapter,
    projectId,
    enabled,
    getPersistableState,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  ]);

  // Debounced save trigger
  const scheduleSave = useCallback(() => {
    if (!enabled || !projectId) return;

    setHasPendingChanges(true);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule debounced save
    debounceTimerRef.current = setTimeout(() => {
      performSave();
      // Clear max wait timer since we saved
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
    }, debounceMs);

    // Set max wait timer if not already set
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        // Force save even if debounce hasn't elapsed
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        performSave();
        maxWaitTimerRef.current = null;
      }, AUTO_SAVE_CONFIG.MAX_WAIT_MS);
    }
  }, [enabled, projectId, debounceMs, performSave]);

  // Manual save (bypasses debounce)
  const saveNow = useCallback(async () => {
    // Clear pending timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    await performSave();
  }, [performSave]);

  // Track previous state for comparison
  const prevStateRef = useRef<{
    fps: number;
    duration: number;
    resolution: { width: number; height: number };
    tracks: Map<string, unknown>;
    clips: Map<string, unknown>;
    mediaLibrary: Map<string, unknown>;
  } | null>(null);

  // Store scheduleSave in a ref to avoid effect re-runs
  const scheduleSaveRef = useRef(scheduleSave);
  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

  // Subscribe to timeline store changes (only persistable fields)
  useEffect(() => {
    if (!enabled || !projectId) return;

    // Subscribe to store changes
    const unsubscribe = useTimelineStore.subscribe((state) => {
      const current = {
        fps: state.fps,
        duration: state.totalDuration,
        resolution: state.resolution,
        tracks: state.tracks,
        clips: state.clips,
        mediaLibrary: state.mediaLibrary,
      };

      const prev = prevStateRef.current;

      // Check if relevant state changed
      const hasChanged =
        !prev ||
        prev.fps !== current.fps ||
        prev.duration !== current.duration ||
        prev.resolution.width !== current.resolution.width ||
        prev.resolution.height !== current.resolution.height ||
        prev.tracks !== current.tracks ||
        prev.clips !== current.clips ||
        prev.mediaLibrary !== current.mediaLibrary;

      if (hasChanged) {
        prevStateRef.current = current;
        scheduleSaveRef.current();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, projectId]);

  // Cleanup timers only on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    };
  }, []);

  // Save before page unload
  useEffect(() => {
    if (!enabled || !projectId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        // Attempt synchronous save (may not complete)
        const data = getPersistableState();
        try {
          // Use synchronous localStorage directly for unload
          localStorage.setItem(
            `${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`,
            JSON.stringify(data)
          );
        } catch {
          // Can't do much if it fails
        }

        // Show browser warning
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, projectId, hasPendingChanges, getPersistableState]);

  return {
    isSaving,
    lastSavedAt,
    saveNow,
    hasPendingChanges,
  };
}
