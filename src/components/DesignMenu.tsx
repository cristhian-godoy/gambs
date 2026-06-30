import { Box, CircleDot, Layers, PenTool, RotateCw, Sliders, Sparkles } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { FeatureType } from '../store/types.ts';

interface MenuItem {
  type: FeatureType;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const DESIGN_ITEMS: MenuItem[] = [
  { type: 'sketch', label: 'Sketch', icon: PenTool },
  { type: 'pad', label: 'Pad', icon: Box },
  { type: 'revolution', label: 'Revolve', icon: RotateCw },
  { type: 'loft', label: 'Loft', icon: Layers },
  { type: 'groove', label: 'Groove', icon: Sliders },
  { type: 'hole', label: 'Hole', icon: CircleDot },
];

interface DesignMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  onAddFeature: (type: FeatureType) => void;
}

/**
 * Renders the Design operations dropdown menu.
 * @returns The rendered DesignMenu component.
 */
export default function DesignMenu({
  isOpen,
  onToggle,
  onClose,
  onAddFeature,
}: DesignMenuProps): ReactNode {
  const handleAddFeature = (type: FeatureType) => {
    onAddFeature(type);
    onClose();
  };

  return (
    <div className="design-menu-container" style={{ position: 'relative' }}>
      <button className="toolbar-btn" onClick={onToggle} title="Design Menu">
        <Sparkles size={16} /> Design
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
            minWidth: '180px',
            padding: '4px 0',
            marginTop: '4px',
          }}
        >
          {DESIGN_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                className="dropdown-item"
                onClick={() => handleAddFeature(item.type)}
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
