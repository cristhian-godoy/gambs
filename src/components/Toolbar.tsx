import { Circle, MousePointer, Redo2, Save, Slash, Square, ToggleLeft, Undo2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { useCad } from '../store/CadContext.tsx';

/**
 * Top Toolbar component containing global actions, drawing tools, and construction toggle.
 * @returns The rendered Toolbar component.
 */
export default function Toolbar(): ReactNode {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    activeTool,
    setActiveTool,
    selectedGeomIds,
    toggleConstructionGeometries,
  } = useCad();

  // Show construction button only if there are selections that are not virtual datums
  const validSelections = selectedGeomIds.filter((id) => !id.startsWith('datum_'));
  const hasSelection = validSelections.length > 0;

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

        {/* Drawing Tools Group */}
        <button
          className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select Tool (Esc)"
        >
          <MousePointer size={16} />
          Select
        </button>
        <button
          className={`toolbar-btn ${activeTool === 'line' ? 'active' : ''}`}
          onClick={() => setActiveTool('line')}
          title="Line Tool"
        >
          <Slash size={16} />
          Line
        </button>
        <button
          className={`toolbar-btn ${activeTool === 'circle' ? 'active' : ''}`}
          onClick={() => setActiveTool('circle')}
          title="Circle Tool"
        >
          <Circle size={16} />
          Circle
        </button>
        <button
          className={`toolbar-btn ${activeTool === 'rect' ? 'active' : ''}`}
          onClick={() => setActiveTool('rect')}
          title="Rectangle Tool"
        >
          <Square size={16} />
          Rectangle
        </button>

        <div className="toolbar-divider" />

        {/* Construction Geometry Toggle */}
        <button
          className="toolbar-btn"
          onClick={() => toggleConstructionGeometries(validSelections)}
          disabled={!hasSelection}
          title="Toggle Construction Line (Ctrl/Shift to select first)"
          style={{
            opacity: hasSelection ? 1 : 0.4,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <ToggleLeft size={16} />
          Construction
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
        <span style={{ fontSize: '0.8rem', color: 'var(--cad-color-text-muted)' }}>
          Mode: {activeTool.toUpperCase()}
        </span>
      </div>
    </header>
  );
}
