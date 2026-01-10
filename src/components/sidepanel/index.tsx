import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidepanelStore } from '@/stores/sidepanelStore';
import { panelRegistry, getPanelById } from './panelRegistry';

export interface ProjectContext {
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
  /** Loading state */
  isLoading?: boolean;
}

interface SidepanelProps {
  /** Project context for ProjectsPanel */
  projectContext?: ProjectContext;
}

export function Sidepanel({ projectContext }: SidepanelProps) {
  const { isOpen, activePanel, width, toggle, setActivePanel, setWidth } =
    useSidepanelStore();
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const activePanelConfig = getPanelById(activePanel);
  const ActivePanelComponent = activePanelConfig?.component;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setWidth(startWidth + delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, setWidth]
  );

  return (
    <div
      className="relative flex flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{ width: isOpen ? width : 0 }}
    >
      {/* Main Panel Content */}
      <div
        className="flex h-full w-full overflow-hidden bg-zinc-900 border-r border-zinc-800"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateX(0)' : `translateX(-${width}px)`,
          transition: 'opacity 200ms ease-in-out, transform 300ms ease-in-out',
        }}
      >
        {/* Tab Bar - Vertical Icons */}
        <div className="flex flex-col items-center w-12 py-2 bg-zinc-950 border-r border-zinc-800 flex-shrink-0">
          {panelRegistry.map((panel) => {
            const Icon = panel.icon;
            const isActive = activePanel === panel.id;
            return (
              <button
                key={panel.id}
                onClick={() => setActivePanel(panel.id)}
                title={panel.label}
                className={`
                  flex items-center justify-center w-10 h-10 rounded-lg mb-1
                  transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }
                `}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        {/* Panel Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between h-10 px-3 border-b border-zinc-800 flex-shrink-0">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {getPanelById(activePanel)?.label}
            </span>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-auto">
            {ActivePanelComponent && (
              activePanelConfig?.requiresProjectContext && projectContext ? (
                <ActivePanelComponent {...projectContext} />
              ) : (
                <ActivePanelComponent />
              )
            )}
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      {isOpen && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className={`
            absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-10
            transition-colors duration-150
            ${isResizing ? 'bg-blue-500' : 'hover:bg-blue-500/50'}
          `}
        />
      )}

      {/* Toggle Button */}
      <button
        onClick={toggle}
        className={`
          absolute top-1/2 -translate-y-1/2 z-20
          flex items-center justify-center
          w-5 h-12 rounded-r-md
          bg-zinc-800 hover:bg-zinc-700
          text-zinc-400 hover:text-white
          transition-all duration-300 ease-in-out
          border border-l-0 border-zinc-700
          ${isOpen ? '-right-5' : 'right-0 translate-x-full'}
        `}
        title={isOpen ? 'Close panel' : 'Open panel'}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </div>
  );
}

export { panelRegistry } from './panelRegistry';
