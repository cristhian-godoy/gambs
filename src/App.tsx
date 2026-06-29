import { type ReactNode, useState } from 'react';

import Sidebar from './components/Sidebar.tsx';
import SketchCanvas from './components/SketchCanvas.tsx';
import Toolbar from './components/Toolbar.tsx';
import { CadProvider } from './store/CadContext.tsx';

/**
 * Main application component managing overall UI layout shell.
 * @returns The rendered App component.
 */
export default function App(): ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <CadProvider>
      <div className="app-container">
        <Toolbar />
        <main className="main-workspace">
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
          <SketchCanvas />
        </main>
      </div>
    </CadProvider>
  );
}
