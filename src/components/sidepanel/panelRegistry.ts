import React from 'react';
import { Film, Subtitles, type LucideIcon } from 'lucide-react';
import { MediaLibraryPanel, SRTImportPanel } from './panels';

export interface SidepanelConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  component: React.FC;
}

export const panelRegistry: SidepanelConfig[] = [
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
