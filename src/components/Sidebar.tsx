import { ChevronLeft, ChevronRight, FolderTree, Trash2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { useCad } from '../store/CadContext.tsx';
import { FeatureType } from '../store/types.ts';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Sidebar component housing the feature tree and properties panel.
 * @param props Props for the sidebar component.
 * @returns The rendered Sidebar component.
 */
export default function Sidebar({ isOpen, onToggle }: SidebarProps): ReactNode {
  const { documentState, setActiveFeature, deleteFeature, addFeature } = useCad();
  const { features, activeFeatureId } = documentState;

  const handleAddMockFeature = (type: FeatureType) => {
    const count = features.filter((f) => f.type === type).length + 1;
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;
    const dependencies = features.length > 0 ? [features[features.length - 1].id] : [];
    addFeature(type, name, {}, dependencies);
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Feature Tree</span>
          <FolderTree size={16} style={{ color: 'var(--cad-color-text-secondary)' }} />
        </div>
        <div className="sidebar-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {features.length === 0 ? (
              <div style={{ color: 'var(--cad-color-text-muted)', fontSize: '0.875rem' }}>
                No features created yet. Use the buttons below to create mock features.
              </div>
            ) : (
              features.map((feature) => {
                const isActive = feature.id === activeFeatureId;
                return (
                  <div
                    key={feature.id}
                    onClick={() => setActiveFeature(feature.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: isActive
                        ? 'var(--cad-glass-bg-hover)'
                        : 'var(--cad-color-surface-tertiary)',
                      border: '1px solid',
                      borderColor: isActive
                        ? 'var(--cad-color-brand-main)'
                        : 'var(--cad-glass-border-base)',
                      borderRadius: 'var(--cad-radius-sm)',
                      cursor: 'pointer',
                      transition: 'all var(--cad-transition-fast)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive
                          ? 'var(--cad-color-text-primary)'
                          : 'var(--cad-color-text-secondary)',
                      }}
                    >
                      {feature.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFeature(feature.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--cad-color-brand-danger)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Delete Feature"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              marginTop: 'auto',
              borderTop: '1px solid var(--cad-glass-border-base)',
              paddingTop: '16px',
            }}
          >
            <p
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--cad-color-text-muted)',
                marginBottom: '8px',
              }}
            >
              Add Feature
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                className="toolbar-btn"
                onClick={() => handleAddMockFeature('sketch')}
                style={{ border: '1px solid var(--cad-glass-border-base)' }}
              >
                + Sketch
              </button>
              <button
                className="toolbar-btn"
                onClick={() => handleAddMockFeature('pad')}
                style={{ border: '1px solid var(--cad-glass-border-base)' }}
              >
                + Pad
              </button>
              <button
                className="toolbar-btn"
                onClick={() => handleAddMockFeature('pocket')}
                style={{ border: '1px solid var(--cad-glass-border-base)' }}
              >
                + Pocket
              </button>
              <button
                className="toolbar-btn"
                onClick={() => handleAddMockFeature('fillet')}
                style={{ border: '1px solid var(--cad-glass-border-base)' }}
              >
                + Fillet
              </button>
            </div>
          </div>
        </div>
      </aside>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        aria-label={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </>
  );
}
