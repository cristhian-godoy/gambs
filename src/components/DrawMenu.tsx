import { Circle, Compass, Slash, Square, ToggleLeft, Triangle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { ToolType } from '../store/CadContext.tsx';
import { useCad } from '../store/CadContext.tsx';

interface DrawItem {
  type: ToolType;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const DRAW_ITEMS: DrawItem[] = [
  { type: 'line', label: 'Line', icon: Slash },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'rect', label: 'Rectangle', icon: Square },
  { type: 'arc', label: 'Arc', icon: Compass },
  { type: 'triangle', label: 'Triangle', icon: Triangle },
  { type: 'slot', label: 'Slot', icon: ToggleLeft },
];

interface DrawMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
}

/**
 * Renders the 2D drawing tools dropdown menu.
 * @returns The rendered DrawMenu component.
 */
export default function DrawMenu({ isOpen, onToggle, onClose }: DrawMenuProps): ReactNode {
  const { activeTool, setActiveTool } = useCad();

  const handleSelectTool = (tool: ToolType) => {
    setActiveTool(activeTool === tool ? 'select' : tool);
    onClose();
  };

  const getDrawingToolLabel = () => {
    const matched = DRAW_ITEMS.find((item) => item.type === activeTool);
    if (matched) {
      const Icon = matched.icon;
      return { text: matched.label, icon: <Icon size={16} /> };
    }
    return { text: 'Draw', icon: <Slash size={16} /> };
  };

  const isDrawActive = DRAW_ITEMS.some((item) => item.type === activeTool);
  const currentDrawTool = getDrawingToolLabel();

  return (
    <div className="draw-menu-container" style={{ position: 'relative' }}>
      <button
        className={`toolbar-btn ${isDrawActive ? 'active' : ''}`}
        onClick={onToggle}
        title="Draw Menu"
      >
        {currentDrawTool.icon} {currentDrawTool.text}
      </button>

      {isOpen && (
        <div
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            backgroundColor: 'var(--cad-color-surface-elevated)',
            border: '1px solid var(--cad-glass-border-base)',
            borderRadius: 'var(--cad-radius-md)',
            boxShadow: 'var(--cad-shadow-glow)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            minWidth: '160px',
            padding: '4px 0',
            marginTop: '4px',
          }}
        >
          {DRAW_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                className={`dropdown-item ${activeTool === item.type ? 'active' : ''}`}
                onClick={() => handleSelectTool(item.type)}
              >
                <Icon size={14} /> {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
