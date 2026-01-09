import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { PanelLeft, Loader2, Cloud, CloudOff, Pencil } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { VideoPreview, PreviewControls } from "@/components/preview";
import { ResizablePanel } from "@/components/ResizablePanel";
import { Sidepanel } from "@/components/sidepanel";
import { useTimelineStore } from "@/stores/timelineStore";
import { useSidepanelStore } from "@/stores/sidepanelStore";
import { exportToMp4, exportWithWebCodecs, isWebCodecsSupported } from "@/utils/export";
import { ExportSettingsModal, type ExportSettings } from "@/components/ExportSettingsModal";
import { ContextPanel } from "@/components/properties/ContextPanel";
import { useAutoSave, useProjectHydration } from "@/hooks";
import { projectManager } from "@/services/persistence";

function App() {
  const {
    currentTime,
    isPlaying,
    togglePlayback,
    setCurrentTime,
    exportTimeline,
    resolution,
  } = useTimelineStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const toggleSidepanel = useSidepanelStore((s) => s.toggle);

  // Project persistence
  const {
    isLoading: isProjectLoading,
    isError: isProjectError,
    currentProject,
    updateProjectName,
  } = useProjectHydration();

  // Auto-save (enabled once project is loaded)
  const { isSaving, hasPendingChanges, saveNow } = useAutoSave({
    adapter: projectManager.getAdapter(),
    projectId: currentProject?.id ?? null,
    enabled: !isProjectLoading && !isProjectError && !!currentProject,
    onSaveError: (err) => {
      toast.error("Failed to save", { description: err.message });
    },
  });

  // Project name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Handle Ctrl+S for manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentProject && !isSaving) {
          saveNow();
          toast.success("Project saved");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentProject, isSaving, saveNow]);

  const handleStartEditName = useCallback(() => {
    if (currentProject) {
      setEditedName(currentProject.name);
      setIsEditingName(true);
    }
  }, [currentProject]);

  const handleSaveName = useCallback(async () => {
    setIsEditingName(false);
    if (!currentProject || !editedName.trim()) return;

    if (editedName.trim() !== currentProject.name) {
      const result = await projectManager.renameProject(currentProject.id, editedName.trim());
      if (result.success) {
        updateProjectName(editedName.trim());
        toast.success("Project renamed");
      } else {
        toast.error("Failed to rename project");
      }
    }
  }, [currentProject, editedName, updateProjectName]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      if (currentProject) {
        setEditedName(currentProject.name);
      }
    }
  }, [handleSaveName, currentProject]);

  const handleExportJson = () => {
    const data = exportTimeline();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timeline-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMp4 = async (settings: ExportSettings) => {
    if (isExporting) return;
    
    // FFmpeg.wasm requires SharedArrayBuffer which requires secure context (https) and specific headers
    // We added headers in vite.config.ts. 
    // It should work in Dev (localhost) and correctly configured Production.

    try {
      setIsExporting(true);
      const store = useTimelineStore.getState();
      
      // Determine which encoder to use
      const useWebCodecs = settings.useHardwareAcceleration && isWebCodecsSupported();
      const encoderName = useWebCodecs ? "GPU" : "CPU";
      const toastId = toast.loading(`Exporting video... (${encoderName} encoding)`);

      const exportFn = useWebCodecs ? exportWithWebCodecs : exportToMp4;
      const blob = await exportFn({
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        quality: settings.quality,
        filename: settings.filename,
        useHardwareAcceleration: settings.useHardwareAcceleration,
        duration: store.totalDuration,
        tracks: store.tracks,
        clips: store.clips,
        onProgress: (progress) => {
          // Show different messages based on phase (approximate)
          if (progress < 0.8) {
              toast.loading(`Rendering... ${Math.round(progress/0.8 * 100)}%`, { id: toastId });
          } else {
              toast.loading(`Encoding (${encoderName})... ${Math.round((progress-0.8)/0.2 * 100)}%`, { id: toastId });
          }
        },
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${settings.filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export complete!", { id: toastId });
      setIsExportModalOpen(false); // Close modal on success
    } catch (error) {
      console.error(error);
      toast.error("Failed to export video", { 
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Show loading screen while project is loading
  if (isProjectLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-zinc-400">Loading project...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (isProjectError) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <CloudOff className="h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-white">Failed to load project</h2>
          <p className="text-zinc-400 max-w-md">
            There was an error loading your project. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidepanel}
            title="Toggle sidepanel ([)"
            className="flex items-center justify-center w-8 h-8 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <PanelLeft size={18} />
          </button>
          {/* Editable project name */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={handleNameKeyDown}
              className="text-lg font-semibold text-white bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 focus:outline-none focus:border-blue-500 min-w-[150px]"
            />
          ) : (
            <button
              onClick={handleStartEditName}
              className="group flex items-center gap-2 text-lg font-semibold text-white hover:text-zinc-300 transition-colors"
              title="Click to rename project"
            >
              {currentProject?.name ?? "React Video Timeline"}
              <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}
          {/* Save status indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                <span className="text-blue-400">Saving...</span>
              </>
            ) : hasPendingChanges ? (
              <>
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-amber-500">Unsaved</span>
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Saved</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Drag clips to move</span>
          <span>•</span>
          <span>Drag handles to trim</span>
          <span>•</span>
          <span>Ctrl+Scroll to zoom</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isExporting}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? "Exporting..." : "Export MP4"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidepanel */}
        <Sidepanel />

        {/* Content Area - now takes full width since ContextPanel is an overlay */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Video Preview Area - min-h-0 allows it to shrink properly */}
          <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-900 p-4">
            <VideoPreview
              currentTime={currentTime}
              isPlaying={isPlaying}
              onTimeUpdate={setCurrentTime}
              className="max-h-full"
            />
          </div>

          {/* Preview Controls - flex-shrink-0 ensures it's always visible */}
          <PreviewControls className="mx-4 mb-2 flex-shrink-0" />
        </div>
      </div>

      {/* Right Context Panel - renders as overlay via Sheet portal */}
      <ContextPanel />

      {/* Timeline - now resizable */}
      <ResizablePanel
        minHeight={150}
        maxHeight={400}
        defaultHeight={224}
      >
        <Timeline
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeChange={setCurrentTime}
          onPlayPause={togglePlayback}
        />
      </ResizablePanel>
      <Toaster position="top-right" theme="dark" />
      
      <ExportSettingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportMp4}
        isExporting={isExporting}
        defaultSettings={{
          width: resolution.width,
          height: resolution.height,
        }}
      />
    </div>
  );
}

export default App;
