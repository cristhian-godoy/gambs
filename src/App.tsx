import { type ReactNode, useState } from 'react';

import Sidebar from './components/Sidebar.tsx';
import Toolbar from './components/Toolbar.tsx';
import Viewport from './components/Viewport.tsx';

/**
 * Main application component managing overall UI layout shell.
 * @returns The rendered App component.
 */
export default function App(): ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-container">
      <Toolbar canUndo={false} canRedo={false} />
      <main className="main-workspace">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)}>
          <div style={{ color: 'var(--cad-color-text-secondary)', fontSize: '0.85rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>History</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ padding: '4px 0', opacity: 0.6 }}>No items in history</li>
            </ul>
          </div>
        </Sidebar>
        <Viewport />
      </main>
    </div>
  );
}
