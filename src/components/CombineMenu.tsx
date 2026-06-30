import { CircleDot, GitMerge, Minus, Plus } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { FeatureType } from '../store/types.ts';

interface MenuItem {
  type: FeatureType;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const COMBINE_ITEMS: MenuItem[] = [
  { type: 'union', label: 'Union', icon: Plus },
  { type: 'difference', label: 'Difference', icon: Minus },
  { type: 'intersection', label: 'Intersect', icon: CircleDot },
];

interface CombineMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  onAddFeature: (type: FeatureType) => void;
}

/**
 * Renders the Combine operations dropdown menu.
 * @returns The rendered CombineMenu component.
 */
export default function CombineMenu({
  isOpen,
  onToggle,
  onClose,
  onAddFeature,
}: CombineMenuProps): ReactNode {
  const handleAddFeature = (type: FeatureType) => {
    onAddFeature(type);
    onClose();
  };

  return (
    <div className="combine-menu-container" style={{ position: 'relative' }}>
      <button className="toolbar-btn" onClick={onToggle} title="Combine Menu">
        <GitMerge size={16} /> Combine
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
          {COMBINE_ITEMS.map((item) => {
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
