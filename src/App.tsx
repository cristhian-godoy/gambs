import { type ReactNode, useEffect, useState } from 'react';

import ContextMenu from './components/ContextMenu.tsx';
import SettingsModal from './components/SettingsModal.tsx';
import Sidebar from './components/Sidebar.tsx';
import SketchCanvas from './components/SketchCanvas.tsx';
import Toolbar from './components/Toolbar.tsx';
import Viewport3D from './components/Viewport3D.tsx';
import { CadProvider, useCad } from './store/CadContext.tsx';

/**
 * Shell workspace component that handles dynamic workspace switching (2D Sketch Editor / 3D Model view).
 * @returns The rendered WorkspaceShell component.
 */
function WorkspaceShell(): ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    documentState,
    undo,
    redo,
    setActiveTool,
    addFeature,
    settings,
    setIsSelectingSupportPlane,
  } = useCad();
  const { activeSketchId, features } = documentState;

  // Apply theme class to document body
  useEffect(() => {
    document.body.className = settings.theme === 'light' ? 'light-theme' : 'dark-theme';
  }, [settings.theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else {
        switch (e.key.toLowerCase()) {
          case 'l':
            if (!activeSketchId) {
              setIsSelectingSupportPlane(true);
            } else {
              setActiveTool('line');
            }
            break;
          case 'c':
            if (!activeSketchId) {
              setIsSelectingSupportPlane(true);
            } else {
              setActiveTool('circle');
            }
            break;
          case 'r':
            if (!activeSketchId) {
              setIsSelectingSupportPlane(true);
            } else {
              setActiveTool('rect');
            }
            break;
          case 's':
          case 'escape':
            setActiveTool('select');
            break;
          case 'e': {
            const count = features.filter((f) => f.type === 'pad').length + 1;
            addFeature(
              'pad',
              `Pad ${count}`,
              {},
              features.length > 0 ? [features[features.length - 1].id] : [],
            );
            break;
          }
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, setActiveTool, addFeature, features, activeSketchId, setIsSelectingSupportPlane]);

  return (
    <div className="app-container">
      <Toolbar onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="main-workspace">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
        {activeSketchId ? <SketchCanvas /> : <Viewport3D />}
      </main>
      <SettingsModal
        key={isSettingsOpen ? 'open' : 'closed'}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ContextMenu />
    </div>
  );
}

/**
 * Main application component managing overall UI layout shell.
 * @returns The rendered App component.
 */
export default function App(): ReactNode {
  return (
    <CadProvider>
      <WorkspaceShell />
    </CadProvider>
  );
}
