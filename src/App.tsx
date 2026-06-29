import { type ReactNode, useState } from 'react';

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
  const { documentState } = useCad();
  const { activeSketchId } = documentState;

  return (
    <div className="app-container">
      <Toolbar />
      <main className="main-workspace">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
        {activeSketchId ? <SketchCanvas /> : <Viewport3D />}
      </main>
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
