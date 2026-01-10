import React from 'react';
import { Film, Subtitles, FolderOpen, type LucideIcon } from 'lucide-react';
import { MediaLibraryPanel, SRTImportPanel, ProjectsPanel } from './panels';

export interface SidepanelConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  component: React.FC<any>;
  /** Whether this panel requires project context props */
  requiresProjectContext?: boolean;
}

export const panelRegistry: SidepanelConfig[] = [
  {
    id: 'projects',
    icon: FolderOpen,
    label: 'Projects',
    component: ProjectsPanel,
    // Note: ProjectsPanel requires props from parent (currentProject, etc.)
    // These are injected by the Sidepanel component
    requiresProjectContext: true,
  },
  {
    id: 'media-library',
    icon: Film,
    label: 'Media',
    component: MediaLibraryPanel,
  },
  {
    id: 'srt-import',
    icon: Subtitles,
    label: 'Subtitles',
    component: SRTImportPanel,
  },
];

export function getPanelById(id: string): SidepanelConfig | undefined {
  return panelRegistry.find((panel) => panel.id === id);
}
