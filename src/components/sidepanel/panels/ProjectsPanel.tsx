import React, { useCallback, useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Pencil,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { projectManager, type ProjectMetadata } from '@/services/persistence';

interface ProjectsPanelProps {
  /** Current project from useProjectHydration */
  currentProject: { id: string; name: string } | null;
  /** Whether there are unsaved changes */
  hasPendingChanges: boolean;
  /** Switch to a project by ID */
  onSwitchProject: (id: string) => Promise<void>;
  /** Create a new project */
  onCreateProject: (name: string) => Promise<unknown>;
  /** Save current project before switching */
  onSaveProject: () => Promise<void>;
  /** Loading state from parent */
  isLoading?: boolean;
}

export function ProjectsPanel({
  currentProject,
  hasPendingChanges,
  onSwitchProject,
  onCreateProject,
  onSaveProject,
  isLoading: externalLoading = false,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'switch' | 'delete';
    projectId: string;
    projectName: string;
  } | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Load project list
  const loadProjects = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const result = await projectManager.listProjects();
      if (result.success) {
        setProjects(result.data);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Switch project (after confirmation if needed)
  const handleSwitchProject = useCallback(
    async (id: string) => {
      setIsSwitching(true);
      setShowConfirmDialog(null);
      try {
        await onSwitchProject(id);
        await loadProjects(); // Refresh list to update "updatedAt"
      } catch (err) {
        console.error('Failed to switch project:', err);
      } finally {
        setIsSwitching(false);
      }
    },
    [onSwitchProject, loadProjects]
  );

  // Handle project click
  const handleProjectClick = useCallback(
    (project: ProjectMetadata) => {
      if (project.id === currentProject?.id) return; // Already selected

      if (hasPendingChanges) {
        setShowConfirmDialog({
          type: 'switch',
          projectId: project.id,
          projectName: project.name,
        });
      } else {
        handleSwitchProject(project.id);
      }
    },
    [currentProject, hasPendingChanges, handleSwitchProject]
  );

  // Save and switch
  const handleSaveAndSwitch = useCallback(async () => {
    if (!showConfirmDialog) return;
    setIsSwitching(true);
    try {
      await onSaveProject();
      await handleSwitchProject(showConfirmDialog.projectId);
    } catch (err) {
      console.error('Failed to save and switch:', err);
      setIsSwitching(false);
    }
  }, [showConfirmDialog, onSaveProject, handleSwitchProject]);

  // Create new project
  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setIsSwitching(true);
    setIsCreatingNew(false);
    try {
      await onCreateProject(newProjectName.trim());
      setNewProjectName('');
      await loadProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSwitching(false);
    }
  }, [newProjectName, onCreateProject, loadProjects]);

  // Start renaming
  const handleStartRename = useCallback(
    (e: React.MouseEvent, project: ProjectMetadata) => {
      e.stopPropagation();
      setEditingId(project.id);
      setEditingName(project.name);
    },
    []
  );

  // Save rename
  const handleSaveRename = useCallback(async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await projectManager.renameProject(editingId, editingName.trim());
      await loadProjects();
    } catch (err) {
      console.error('Failed to rename project:', err);
    } finally {
      setEditingId(null);
    }
  }, [editingId, editingName, loadProjects]);

  // Duplicate project
  const handleDuplicate = useCallback(
    async (e: React.MouseEvent, project: ProjectMetadata) => {
      e.stopPropagation();
      try {
        await projectManager.duplicateProject(project.id, `${project.name} (Copy)`);
        await loadProjects();
      } catch (err) {
        console.error('Failed to duplicate project:', err);
      }
    },
    [loadProjects]
  );

  // Delete project
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, project: ProjectMetadata) => {
      e.stopPropagation();
      setShowConfirmDialog({
        type: 'delete',
        projectId: project.id,
        projectName: project.name,
      });
    },
    []
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!showConfirmDialog || showConfirmDialog.type !== 'delete') return;
    try {
      await projectManager.deleteProject(showConfirmDialog.projectId);
      setShowConfirmDialog(null);
      await loadProjects();

      // If we deleted the current project, switch to another
      if (showConfirmDialog.projectId === currentProject?.id) {
        const result = await projectManager.listProjects();
        if (result.success && result.data.length > 0) {
          await onSwitchProject(result.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }, [showConfirmDialog, currentProject, loadProjects, onSwitchProject]);

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isLoading = externalLoading || isLoadingList || isSwitching;

  return (
    <div className="flex flex-col h-full">
      {/* Header with New Project button */}
      <div className="p-3 border-b border-zinc-700">
        {isCreatingNew ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setIsCreatingNew(false);
              }}
              placeholder="Project name..."
              className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="p-1.5 text-green-400 hover:bg-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Create"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setIsCreatingNew(false);
                setNewProjectName('');
              }}
              className="p-1.5 text-zinc-400 hover:bg-zinc-700 rounded"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreatingNew(true)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        )}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingList && projects.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm">
            <FolderOpen size={32} className="mb-2 opacity-50" />
            <p>No projects yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {projects.map((project) => {
              const isActive = project.id === currentProject?.id;
              const isEditing = editingId === project.id;

              return (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className={`
                    group relative p-3 rounded-lg cursor-pointer transition-colors
                    ${isActive
                      ? 'bg-blue-600/20 border border-blue-500/50'
                      : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-700/50 hover:border-zinc-600'
                    }
                    ${isSwitching ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Project info */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={handleSaveRename}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-1.5 py-0.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-sm font-medium text-white truncate">
                          {project.name}
                          {isActive && hasPendingChanges && (
                            <span className="ml-1.5 text-amber-400 text-xs">●</span>
                          )}
                        </h3>
                      )}
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatRelativeTime(project.updatedAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(e, project)}
                          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-600 rounded"
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDuplicate(e, project)}
                          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-600 rounded"
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        {projects.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteClick(e, project)}
                            className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-600 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-800 rounded-lg p-4 max-w-sm w-full shadow-xl border border-zinc-700">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  {showConfirmDialog.type === 'switch'
                    ? 'Unsaved Changes'
                    : 'Delete Project'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {showConfirmDialog.type === 'switch'
                    ? `You have unsaved changes. Save before switching to "${showConfirmDialog.projectName}"?`
                    : `Are you sure you want to delete "${showConfirmDialog.projectName}"? This cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded"
              >
                Cancel
              </button>
              {showConfirmDialog.type === 'switch' ? (
                <>
                  <button
                    onClick={() => handleSwitchProject(showConfirmDialog.projectId)}
                    className="px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded"
                  >
                    Don't Save
                  </button>
                  <button
                    onClick={handleSaveAndSwitch}
                    disabled={isSwitching}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                  >
                    {isSwitching ? 'Saving...' : 'Save & Switch'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
