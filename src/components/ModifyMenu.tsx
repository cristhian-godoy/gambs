import {
  Copy,
  CornerDownRight,
  LayoutGrid,
  MoveUp,
  RotateCw,
  Slash,
  Sliders,
  Square,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { FeatureType } from '../store/types.ts';

interface MenuItem {
  type: FeatureType;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const MODIFY_ITEMS: MenuItem[] = [
  { type: 'fillet', label: 'Fillet', icon: CornerDownRight },
  { type: 'chamfer', label: 'Chamfer', icon: Slash },
  { type: 'draft', label: 'Draft', icon: MoveUp },
  { type: 'thickness', label: 'Shell', icon: Square },
  { type: 'linear_pattern', label: 'Linear Pattern', icon: LayoutGrid },
  { type: 'polar_pattern', label: 'Polar Pattern', icon: RotateCw },
  { type: 'mirror', label: 'Mirror', icon: Copy },
];

interface ModifyMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  onAddFeature: (type: FeatureType) => void;
}

/**
 * Renders the 3D Modify operations dropdown menu.
 * @returns The rendered ModifyMenu component.
 */
export default function ModifyMenu({
  isOpen,
  onToggle,
  onClose,
  onAddFeature,
}: ModifyMenuProps): ReactNode {
  const handleAddFeature = (type: FeatureType) => {
    onAddFeature(type);
    onClose();
  };

  return (
    <div className="modify-menu-container" style={{ position: 'relative' }}>
      <button className="toolbar-btn" onClick={onToggle} title="Modify Menu">
        <Sliders size={16} /> Modify
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
          {MODIFY_ITEMS.map((item) => {
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
