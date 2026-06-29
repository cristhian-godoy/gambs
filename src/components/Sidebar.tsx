import { ChevronLeft, ChevronRight, FolderTree, Trash2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { useCad } from '../store/CadContext.tsx';
import type { FeatureType } from '../store/types.ts';

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
  const {
    documentState,
    setActiveFeature,
    deleteFeature,
    addFeature,
    updateFeature,
    enterSketchEdit,
  } = useCad();
  const { features, activeFeatureId } = documentState;

  const handleAddMockFeature = (type: FeatureType) => {
    const count = features.filter((f) => f.type === type).length + 1;
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;
    const dependencies = features.length > 0 ? [features[features.length - 1].id] : [];
    addFeature(type, name, {}, dependencies);
  };

  const activeFeature = features.find((f) => f.id === activeFeatureId);

  const renderPropertiesPanel = () => {
    if (!activeFeature) return null;

    const handleParamChange = (name: string, value: unknown) => {
      updateFeature(activeFeature.id, { [name]: value });
    };

    const sketchFeatures = features.filter((f) => f.type === 'sketch');
    const helixFeatures = features.filter((f) => f.type === 'helix');
    const solidFeatures = features.filter(
      (f) =>
        f.type === 'pad' ||
        f.type === 'pocket' ||
        f.type === 'revolution' ||
        f.type === 'groove' ||
        f.type === 'loft' ||
        f.type === 'pipe',
    );

    return (
      <div
        className="properties-panel"
        style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--cad-color-surface-tertiary)',
          borderRadius: 'var(--cad-radius-md)',
          border: '1px solid var(--cad-glass-border-base)',
        }}
      >
        <h4
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--cad-color-text-muted)',
            marginBottom: '12px',
          }}
        >
          Properties: {activeFeature.name}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeFeature.type === 'sketch' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Z Offset (mm)
              </label>
              <input
                type="number"
                value={(activeFeature.params.zOffset as number) ?? 0}
                onChange={(e) => handleParamChange('zOffset', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              />
              <button
                className="toolbar-btn primary"
                onClick={() => enterSketchEdit(activeFeature.id)}
                style={{ width: '100%', marginTop: '8px' }}
              >
                ✏️ Edit Sketch Geometries
              </button>
            </div>
          )}

          {(activeFeature.type === 'pad' || activeFeature.type === 'pocket') && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Distance / Depth (mm)
              </label>
              <input
                type="number"
                value={
                  (activeFeature.params.distance as number) ??
                  (activeFeature.type === 'pad' ? 10 : 5)
                }
                onChange={(e) => handleParamChange('distance', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              />
            </div>
          )}

          {(activeFeature.type === 'revolution' || activeFeature.type === 'groove') && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Angle (deg)
                </label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={(activeFeature.params.angle as number) ?? 360}
                  onChange={(e) =>
                    handleParamChange(
                      'angle',
                      Math.min(360, Math.max(0, parseFloat(e.target.value) || 0)),
                    )
                  }
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Axis
                </label>
                <select
                  value={(activeFeature.params.axis as string) ?? 'Y'}
                  onChange={(e) => handleParamChange('axis', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="Y">Y Axis (Vertical)</option>
                  <option value="X">X Axis (Horizontal)</option>
                </select>
              </div>
            </>
          )}

          {activeFeature.type === 'loft' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Select Profiles (Sketches)
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  background: 'var(--cad-color-surface-secondary)',
                  padding: '6px',
                  borderRadius: 'var(--cad-radius-sm)',
                  border: '1px solid var(--cad-glass-border-base)',
                }}
              >
                {sketchFeatures.map((sk) => {
                  const selectedSketches = (activeFeature.params.sketches as string[]) || [];
                  const isChecked = selectedSketches.includes(sk.id);
                  return (
                    <label
                      key={sk.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--cad-color-text-secondary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const nextSketches = isChecked
                            ? selectedSketches.filter((id) => id !== sk.id)
                            : [...selectedSketches, sk.id];
                          handleParamChange('sketches', nextSketches);
                        }}
                      />
                      {sk.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {activeFeature.type === 'pipe' && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Profile (Sketch)
                </label>
                <select
                  value={(activeFeature.params.profileSketchId as string) ?? ''}
                  onChange={(e) => handleParamChange('profileSketchId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="">-- Select Sketch --</option>
                  {sketchFeatures.map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Trajectory Type
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`toolbar-btn ${!activeFeature.params.trajectoryHelixId ? 'active' : ''}`}
                    onClick={() => {
                      handleParamChange('trajectoryHelixId', undefined);
                    }}
                    style={{ flex: 1, fontSize: '0.7rem' }}
                  >
                    Sketch Path
                  </button>
                  <button
                    className={`toolbar-btn ${activeFeature.params.trajectoryHelixId ? 'active' : ''}`}
                    onClick={() => {
                      if (helixFeatures.length > 0) {
                        handleParamChange('trajectoryHelixId', helixFeatures[0].id);
                      }
                    }}
                    style={{ flex: 1, fontSize: '0.7rem' }}
                  >
                    Helix Path
                  </button>
                </div>
              </div>
              {!activeFeature.params.trajectoryHelixId ? (
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--cad-color-text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Trajectory (Sketch)
                  </label>
                  <select
                    value={(activeFeature.params.trajectorySketchId as string) ?? ''}
                    onChange={(e) => handleParamChange('trajectorySketchId', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: 'var(--cad-color-surface-secondary)',
                      border: '1px solid var(--cad-glass-border-base)',
                      borderRadius: 'var(--cad-radius-sm)',
                      color: 'var(--cad-color-text-primary)',
                    }}
                  >
                    <option value="">-- Select Sketch --</option>
                    {sketchFeatures.map((sk) => (
                      <option key={sk.id} value={sk.id}>
                        {sk.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--cad-color-text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Trajectory (Helix)
                  </label>
                  <select
                    value={(activeFeature.params.trajectoryHelixId as string) ?? ''}
                    onChange={(e) => handleParamChange('trajectoryHelixId', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: 'var(--cad-color-surface-secondary)',
                      border: '1px solid var(--cad-glass-border-base)',
                      borderRadius: 'var(--cad-radius-sm)',
                      color: 'var(--cad-color-text-primary)',
                    }}
                  >
                    <option value="">-- Select Helix --</option>
                    {helixFeatures.map((hx) => (
                      <option key={hx.id} value={hx.id}>
                        {hx.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {activeFeature.type === 'helix' && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Pitch (mm)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.pitch as number) ?? 5}
                  onChange={(e) => handleParamChange('pitch', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Height (mm)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.height as number) ?? 20}
                  onChange={(e) => handleParamChange('height', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Radius (mm)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.radius as number) ?? 10}
                  onChange={(e) => handleParamChange('radius', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Handedness
                </label>
                <select
                  value={(activeFeature.params.handedness as string) ?? 'right'}
                  onChange={(e) => handleParamChange('handedness', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="right">Right Handed</option>
                  <option value="left">Left Handed</option>
                </select>
              </div>
            </>
          )}

          {activeFeature.type === 'fillet' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Radius (mm)
              </label>
              <input
                type="number"
                value={(activeFeature.params.radius as number) ?? 2}
                onChange={(e) => handleParamChange('radius', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              />
            </div>
          )}

          {activeFeature.type === 'chamfer' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Distance (mm)
              </label>
              <input
                type="number"
                value={(activeFeature.params.distance as number) ?? 2}
                onChange={(e) => handleParamChange('distance', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              />
            </div>
          )}

          {activeFeature.type === 'draft' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Draft Angle (deg)
              </label>
              <input
                type="number"
                value={(activeFeature.params.angle as number) ?? 5}
                onChange={(e) => handleParamChange('angle', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              />
            </div>
          )}

          {activeFeature.type === 'thickness' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Wall Thickness (mm)
              </label>
              <input
                type="number"
                value={(activeFeature.params.thickness as number) ?? 2}
                onChange={(e) => handleParamChange('thickness', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              />
            </div>
          )}

          {activeFeature.type === 'hole' && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Hole Type
                </label>
                <select
                  value={(activeFeature.params.holeType as string) ?? 'simple'}
                  onChange={(e) => handleParamChange('holeType', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="simple">Simple Hole</option>
                  <option value="counterbore">Counterbore</option>
                  <option value="countersink">Countersink</option>
                  <option value="tapped">Tapped Hole</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Size (Diameter mm)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.size as number) ?? 4}
                  onChange={(e) => handleParamChange('size', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Depth (mm)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.depth as number) ?? 10}
                  onChange={(e) => handleParamChange('depth', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
            </>
          )}

          {activeFeature.type === 'linear_pattern' && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Instance Count
                </label>
                <input
                  type="number"
                  min="2"
                  value={(activeFeature.params.count as number) ?? 2}
                  onChange={(e) => handleParamChange('count', parseInt(e.target.value) || 2)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Spacing (mm)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.spacing as number) ?? 15}
                  onChange={(e) => handleParamChange('spacing', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Direction
                </label>
                <select
                  value={(activeFeature.params.direction as string) ?? 'X'}
                  onChange={(e) => handleParamChange('direction', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="X">X Axis</option>
                  <option value="Y">Y Axis</option>
                  <option value="Z">Z Axis</option>
                </select>
              </div>
            </>
          )}

          {activeFeature.type === 'polar_pattern' && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Instance Count
                </label>
                <input
                  type="number"
                  min="2"
                  value={(activeFeature.params.count as number) ?? 4}
                  onChange={(e) => handleParamChange('count', parseInt(e.target.value) || 4)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Total Angle (deg)
                </label>
                <input
                  type="number"
                  value={(activeFeature.params.totalAngle as number) ?? 360}
                  onChange={(e) =>
                    handleParamChange('totalAngle', parseFloat(e.target.value) || 360)
                  }
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Rotation Axis
                </label>
                <select
                  value={(activeFeature.params.axis as string) ?? 'Z'}
                  onChange={(e) => handleParamChange('axis', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="Z">Z Axis</option>
                  <option value="Y">Y Axis</option>
                  <option value="X">X Axis</option>
                </select>
              </div>
            </>
          )}

          {activeFeature.type === 'mirror' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-secondary)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Symmetry Plane
              </label>
              <select
                value={(activeFeature.params.plane as string) ?? 'YZ'}
                onChange={(e) => handleParamChange('plane', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--cad-color-surface-secondary)',
                  border: '1px solid var(--cad-glass-border-base)',
                  borderRadius: 'var(--cad-radius-sm)',
                  color: 'var(--cad-color-text-primary)',
                }}
              >
                <option value="YZ">YZ Plane (Mirror X)</option>
                <option value="XZ">XZ Plane (Mirror Y)</option>
                <option value="XY">XY Plane (Mirror Z)</option>
              </select>
            </div>
          )}

          {(activeFeature.type === 'union' ||
            activeFeature.type === 'difference' ||
            activeFeature.type === 'intersection') && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Feature A (Base Solid)
                </label>
                <select
                  value={(activeFeature.params.featureAId as string) ?? ''}
                  onChange={(e) => handleParamChange('featureAId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="">-- Select Feature A --</option>
                  {solidFeatures
                    .filter((sf) => sf.id !== activeFeature.id)
                    .map((sf) => (
                      <option key={sf.id} value={sf.id}>
                        {sf.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cad-color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Feature B (Tool Solid)
                </label>
                <select
                  value={(activeFeature.params.featureBId as string) ?? ''}
                  onChange={(e) => handleParamChange('featureBId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'var(--cad-color-surface-secondary)',
                    border: '1px solid var(--cad-glass-border-base)',
                    borderRadius: 'var(--cad-radius-sm)',
                    color: 'var(--cad-color-text-primary)',
                  }}
                >
                  <option value="">-- Select Feature B --</option>
                  {solidFeatures
                    .filter((sf) => sf.id !== activeFeature.id)
                    .map((sf) => (
                      <option key={sf.id} value={sf.id}>
                        {sf.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Feature Tree</span>
          <FolderTree size={16} style={{ color: 'var(--cad-color-text-secondary)' }} />
        </div>
        <div
          className="sidebar-content"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}
        >
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
                      {feature.type === 'sketch' && feature.params.converged === false && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#ef4444',
                            fontWeight: 'bold',
                            marginLeft: '8px',
                          }}
                        >
                          (Conflict)
                        </span>
                      )}
                      {feature.type === 'sketch' &&
                        feature.params.converged !== false &&
                        feature.params.dof !== undefined && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color:
                                (feature.params.dof as number) === 0
                                  ? '#22c55e'
                                  : 'var(--cad-color-text-muted)',
                              fontWeight: (feature.params.dof as number) === 0 ? 'bold' : 'normal',
                              marginLeft: '8px',
                            }}
                          >
                            ({feature.params.dof as number} DOF)
                          </span>
                        )}
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

          {renderPropertiesPanel()}

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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '160px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--cad-color-text-muted)',
                  fontWeight: 'bold',
                }}
              >
                Sketching & 3D Solids
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('sketch')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Sketch
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('pad')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Pad
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('pocket')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Pocket
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('revolution')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Revolve
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('groove')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Groove
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('loft')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Loft
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('pipe')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Pipe
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('helix')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Helix
                </button>
              </div>

              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--cad-color-text-muted)',
                  fontWeight: 'bold',
                  marginTop: '4px',
                }}
              >
                Dress-up & Engineering
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('fillet')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Fillet
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('chamfer')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Chamfer
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('draft')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Draft
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('thickness')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Shell
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('hole')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Hole
                </button>
              </div>

              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--cad-color-text-muted)',
                  fontWeight: 'bold',
                  marginTop: '4px',
                }}
              >
                Transforms & Booleans
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('linear_pattern')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Linear Pat
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('polar_pattern')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Polar Pat
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('mirror')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Mirror
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('union')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Union
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('difference')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Diff
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => handleAddMockFeature('intersection')}
                  style={{ border: '1px solid var(--cad-glass-border-base)', fontSize: '0.75rem' }}
                >
                  + Intersect
                </button>
              </div>
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
