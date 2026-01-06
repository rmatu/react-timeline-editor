import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidepanelState {
  isOpen: boolean;
  activePanel: string;
  width: number;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  setActivePanel: (id: string) => void;
  setWidth: (width: number) => void;
}

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 240;
const MAX_WIDTH = 400;

export const useSidepanelStore = create<SidepanelState>()(
  persist(
    (set) => ({
      isOpen: true,
      activePanel: 'media-library',
      width: DEFAULT_WIDTH,

      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActivePanel: (id: string) => set({ activePanel: id, isOpen: true }),
      setWidth: (width: number) =>
        set({ width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)) }),
    }),
    {
      name: 'sidepanel-storage',
      partialize: (state) => ({
        isOpen: state.isOpen,
        activePanel: state.activePanel,
        width: state.width,
      }),
    }
  )
);

export { DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH };
