import { Redo2, Save, Undo2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { useCad } from '../store/CadContext.tsx';

/**
 * Top Toolbar component containing global actions.
 * @returns The rendered Toolbar component.
 */
export default function Toolbar(): ReactNode {
  const { undo, redo, canUndo, canRedo } = useCad();

  return (
    <header className="top-toolbar">
      <div className="toolbar-group">
        <span className="toolbar-title">
          <span>📐</span> SPA CAD
        </span>
        <button className="toolbar-btn primary" title="Save Project">
          <Save size={16} />
          Save
        </button>
        <div className="toolbar-divider" />
        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <Undo2 size={16} />
          Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <Redo2 size={16} />
          Redo
        </button>
      </div>
      <div className="toolbar-group">
        <span style={{ fontSize: '0.8rem', color: 'var(--cad-color-text-muted)' }}>Ready</span>
      </div>
    </header>
  );
}
