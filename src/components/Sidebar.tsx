import {
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderTree,
  Layers,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useCad } from '../store/CadContext.tsx';
import type { Feature } from '../store/types.ts';

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
    isSelectingSupportPlane,
    setIsSelectingSupportPlane,
    setActiveBody,
    showContextMenu,
  } = useCad();
  const { features, activeFeatureId, activeBodyId } = documentState;

  const [width, setWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);

  const [originExpanded, setOriginExpanded] = useState(true);
  const [axesExpanded, setAxesExpanded] = useState(false);
  const [planesExpanded, setPlanesExpanded] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setWidth(Math.max(240, Math.min(600, e.clientX)));
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
          {activeFeature.type === 'sketch' && activeFeature.params.isDatum !== true && (
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

  const LocalOriginFolder = ({
    nodeId,
    depth,
    localOriginPoints,
  }: {
    nodeId: string;
    depth: number;
    localOriginPoints: Feature[];
  }) => {
    const localOriginExpandedKey = `origin_${nodeId}`;
    const isLocalOriginExpanded = expandedNodes[localOriginExpandedKey] !== false;

    const axisFeatures = localOriginPoints.filter((f) => f.id.includes('axis_'));
    const planeFeatures = localOriginPoints.filter((f) => f.id.includes('plane_'));
    const originFeat = localOriginPoints.find((f) => f.id.includes('origin'));

    const areAxesVisible = axisFeatures.some((f) => f.params.visible !== false);
    const arePlanesVisible = planeFeatures.some((f) => f.params.visible !== false);

    const renderLocalDatumRow = (feat: Feature | undefined, label: string, paddingLeft: string) => {
      if (!feat) return null;
      const isVisible = feat.params.visible !== false;
      const isActive = activeFeatureId === feat.id;
      return (
        <div
          key={feat.id}
          onClick={() => {
            if (isSelectingSupportPlane && feat.id.includes('plane')) {
              const count =
                features.filter((f) => f.type === 'sketch' && !f.params.isDatum).length + 1;
              const name = `Sketch ${count}`;
              const dependencies = [feat.id];
              const newSketchId = addFeature(
                'sketch',
                name,
                { supportPlaneId: feat.id, geometries: [], constraints: [] },
                dependencies,
              );
              setIsSelectingSupportPlane(false);
              enterSketchEdit(newSketchId);
            } else {
              setActiveFeature(feat.id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 8px 2px ' + paddingLeft,
            background: isActive ? 'var(--cad-glass-bg-hover)' : 'transparent',
            borderLeft: isActive ? '2px solid var(--cad-color-brand-main)' : 'none',
            borderRadius: 'var(--cad-radius-sm)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: isActive ? 'var(--cad-color-text-primary)' : 'var(--cad-color-text-secondary)',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {label}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateFeature(feat.id, { visible: !isVisible });
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: isVisible ? 'var(--cad-color-brand-main)' : 'var(--cad-color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
            title={isVisible ? 'Hide' : 'Show'}
          >
            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>
      );
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          marginLeft: `${depth * 12}px`,
        }}
      >
        <div
          onClick={() => toggleNode(localOriginExpandedKey)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 8px',
            background: 'var(--cad-color-surface-tertiary)',
            border: '1px solid var(--cad-glass-border-base)',
            borderRadius: 'var(--cad-radius-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isLocalOriginExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <FolderTree size={12} style={{ color: 'var(--cad-color-brand-main)' }} />
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--cad-color-text-primary)',
              }}
            >
              Origin
            </span>
          </div>
          {originFeat && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const isVisible = originFeat.params.visible !== false;
                updateFeature(originFeat.id, { visible: !isVisible });
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color:
                  originFeat.params.visible !== false
                    ? 'var(--cad-color-brand-main)'
                    : 'var(--cad-color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title={
                originFeat.params.visible !== false ? 'Hide Origin Point' : 'Show Origin Point'
              }
            >
              {originFeat.params.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          )}
        </div>

        {isLocalOriginExpanded && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              borderLeft: '1px solid var(--cad-glass-border-base)',
              marginLeft: '6px',
              paddingLeft: '4px',
            }}
          >
            {/* Axes Folder */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 8px',
              }}
              onClick={() => toggleNode(`axes_${nodeId}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {expandedNodes[`axes_${nodeId}`] !== false ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--cad-color-text-secondary)',
                  }}
                >
                  Axes
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  axisFeatures.forEach((f) => updateFeature(f.id, { visible: !areAxesVisible }));
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: areAxesVisible
                    ? 'var(--cad-color-brand-main)'
                    : 'var(--cad-color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
              >
                {areAxesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
            {expandedNodes[`axes_${nodeId}`] !== false && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {renderLocalDatumRow(
                  axisFeatures.find((f) => f.id.includes('axis_x')),
                  'X Axis',
                  '12px',
                )}
                {renderLocalDatumRow(
                  axisFeatures.find((f) => f.id.includes('axis_y')),
                  'Y Axis',
                  '12px',
                )}
                {renderLocalDatumRow(
                  axisFeatures.find((f) => f.id.includes('axis_z')),
                  'Z Axis',
                  '12px',
                )}
              </div>
            )}

            {/* Planes Folder */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 8px',
              }}
              onClick={() => toggleNode(`planes_${nodeId}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {expandedNodes[`planes_${nodeId}`] !== false ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--cad-color-text-secondary)',
                  }}
                >
                  Planes
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  planeFeatures.forEach((f) => updateFeature(f.id, { visible: !arePlanesVisible }));
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: arePlanesVisible
                    ? 'var(--cad-color-brand-main)'
                    : 'var(--cad-color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
              >
                {arePlanesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
            {expandedNodes[`planes_${nodeId}`] !== false && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {renderLocalDatumRow(
                  planeFeatures.find((f) => f.id.includes('plane_xy')),
                  'XY Plane',
                  '12px',
                )}
                {renderLocalDatumRow(
                  planeFeatures.find((f) => f.id.includes('plane_yz')),
                  'YZ Plane',
                  '12px',
                )}
                {renderLocalDatumRow(
                  planeFeatures.find((f) => f.id.includes('plane_zx')),
                  'ZX Plane',
                  '12px',
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFeatureNode = (feature: Feature, depth: number = 0): ReactNode => {
    const isExpanded = expandedNodes[feature.id] !== false;
    const isActive = feature.id === activeFeatureId;
    const isBody = feature.type === 'body';
    const isPart = feature.type === 'part';
    const isActiveBody = activeBodyId === feature.id;

    const children = features.filter((f) => f.parentId === feature.id && f.params.isDatum !== true);
    const localOriginPoints = features.filter(
      (f) => f.parentId === feature.id && f.params.isDatum === true,
    );
    const hasLocalOrigin = localOriginPoints.length > 0;

    return (
      <div key={feature.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div
          onClick={() => {
            setActiveFeature(feature.id);
            if (isBody) {
              setActiveBody(isActiveBody ? null : feature.id);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, [
              {
                label: 'Rename',
                action: () => {
                  const newName = prompt('Enter new feature name:', feature.name);
                  if (newName && newName.trim() !== '') {
                    updateFeature(feature.id, { name: newName.trim() });
                  }
                },
              },
              {
                label: 'Delete',
                action: () => {
                  deleteFeature(feature.id);
                },
              },
            ]);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            background: isActive
              ? 'var(--cad-glass-bg-hover)'
              : isActiveBody
                ? 'rgba(34, 197, 94, 0.1)'
                : 'var(--cad-color-surface-tertiary)',
            border: '1px solid',
            borderColor: isActive
              ? 'var(--cad-color-brand-main)'
              : isActiveBody
                ? 'var(--cad-color-brand-success, #22c55e)'
                : 'var(--cad-glass-border-base)',
            borderRadius: 'var(--cad-radius-sm)',
            cursor: 'pointer',
            marginLeft: `${depth * 12}px`,
            transition: 'all var(--cad-transition-fast)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(isBody || isPart) && (
              <div
                onClick={(e) => toggleNode(feature.id, e)}
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
            )}
            {isPart ? (
              <Layers size={12} style={{ color: 'var(--cad-color-brand-main)' }} />
            ) : isBody ? (
              <Box
                size={12}
                style={{
                  color: isActiveBody
                    ? 'var(--cad-color-brand-success, #22c55e)'
                    : 'var(--cad-color-text-secondary)',
                }}
              />
            ) : null}
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: isActive || isActiveBody ? 600 : 400,
                color: isActive
                  ? 'var(--cad-color-text-primary)'
                  : isActiveBody
                    ? 'var(--cad-color-brand-success, #22c55e)'
                    : 'var(--cad-color-text-secondary)',
              }}
            >
              {feature.name}
              {isActiveBody && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    marginLeft: '6px',
                    color: 'var(--cad-color-brand-success, #22c55e)',
                    fontStyle: 'italic',
                  }}
                >
                  (Active)
                </span>
              )}
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isPart && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const isVisible = feature.params.visible !== false;
                  updateFeature(feature.id, { visible: !isVisible });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color:
                    feature.params.visible !== false
                      ? 'var(--cad-color-brand-main)'
                      : 'var(--cad-color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
                title={feature.params.visible !== false ? 'Hide Part' : 'Show Part'}
              >
                {feature.params.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete "${feature.name}"?`)) {
                  deleteFeature(feature.id);
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--cad-color-brand-danger)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
              title="Delete Feature"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Collapsible Children */}
        {(isBody || isPart) && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {hasLocalOrigin && (
              <LocalOriginFolder
                nodeId={feature.id}
                depth={depth + 1}
                localOriginPoints={localOriginPoints}
              />
            )}
            {children.map((child) => renderFeatureNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside
        className={`sidebar ${isOpen ? '' : 'collapsed'}`}
        style={{
          width: isOpen ? `${width}px` : '0px',
          transition: dragging ? 'none' : undefined,
        }}
      >
        <div className="sidebar-header">
          <FolderTree size={16} style={{ color: 'var(--cad-color-text-secondary)' }} />
        </div>
        <div
          className="sidebar-content"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}
          onContextMenu={(e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, [
              {
                label: 'Add Part',
                action: () => {
                  const count = features.filter((f) => f.type === 'part').length + 1;
                  addFeature('part', `Part ${count}`);
                },
              },
              {
                label: 'Add Body',
                action: () => {
                  const count = features.filter((f) => f.type === 'body').length + 1;
                  addFeature('body', `Body ${count}`);
                },
              },
            ]);
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              const rootUserFeatures = features.filter(
                (f) => !f.parentId && f.params.isDatum !== true,
              );

              const globalOriginFeat = features.find((f) => f.id === 'datum_origin');
              const globalAxisFeatures = features.filter(
                (f) => f.id.startsWith('datum_axis_') && !f.parentId,
              );
              const globalPlaneFeatures = features.filter(
                (f) => f.id.startsWith('datum_plane_') && !f.parentId,
              );
              const areGlobalAxesVisible = globalAxisFeatures.some(
                (f) => f.params.visible !== false,
              );
              const areGlobalPlanesVisible = globalPlaneFeatures.some(
                (f) => f.params.visible !== false,
              );

              const renderDatumRow = (
                feat: Feature | undefined,
                label: string,
                paddingLeft: string,
              ) => {
                if (!feat) return null;
                const isVisible = feat.params.visible !== false;
                const isActive = activeFeatureId === feat.id;
                return (
                  <div
                    key={feat.id}
                    onClick={() => {
                      if (isSelectingSupportPlane && feat.id.startsWith('datum_plane_')) {
                        const count =
                          features.filter((f) => f.type === 'sketch' && !f.params.isDatum).length +
                          1;
                        const name = `Sketch ${count}`;
                        const dependencies = [feat.id];
                        const newSketchId = addFeature(
                          'sketch',
                          name,
                          { supportPlaneId: feat.id, geometries: [], constraints: [] },
                          dependencies,
                        );
                        setIsSelectingSupportPlane(false);
                        enterSketchEdit(newSketchId);
                      } else {
                        setActiveFeature(feat.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '2px 8px 2px ' + paddingLeft,
                      background: isActive ? 'var(--cad-glass-bg-hover)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--cad-color-brand-main)' : 'none',
                      borderRadius: 'var(--cad-radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: isActive
                          ? 'var(--cad-color-text-primary)'
                          : 'var(--cad-color-text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFeature(feat.id, { visible: !isVisible });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isVisible
                          ? 'var(--cad-color-brand-main)'
                          : 'var(--cad-color-text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px',
                      }}
                      title={isVisible ? 'Hide' : 'Show'}
                    >
                      {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  </div>
                );
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Collapsible Origin Root Node */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div
                      onClick={() => setOriginExpanded(!originExpanded)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 8px',
                        background: 'var(--cad-color-surface-tertiary)',
                        border: '1px solid var(--cad-glass-border-base)',
                        borderRadius: 'var(--cad-radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {originExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <FolderTree size={12} style={{ color: 'var(--cad-color-brand-main)' }} />
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--cad-color-text-primary)',
                          }}
                        >
                          Origin
                        </span>
                      </div>
                      {globalOriginFeat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const isVisible = globalOriginFeat.params.visible !== false;
                            updateFeature(globalOriginFeat.id, { visible: !isVisible });
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color:
                              globalOriginFeat.params.visible !== false
                                ? 'var(--cad-color-brand-main)'
                                : 'var(--cad-color-text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={
                            globalOriginFeat.params.visible !== false
                              ? 'Hide Origin Point'
                              : 'Show Origin Point'
                          }
                        >
                          {globalOriginFeat.params.visible !== false ? (
                            <Eye size={12} />
                          ) : (
                            <EyeOff size={12} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Origin Children: Axes & Planes */}
                    {originExpanded && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          borderLeft: '1px solid var(--cad-glass-border-base)',
                          marginLeft: '6px',
                          paddingLeft: '4px',
                        }}
                      >
                        {/* Axes Folder */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            padding: '2px 8px',
                          }}
                          onClick={() => setAxesExpanded(!axesExpanded)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {axesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--cad-color-text-secondary)',
                              }}
                            >
                              Axes
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              globalAxisFeatures.forEach((f) => {
                                updateFeature(f.id, { visible: !areGlobalAxesVisible });
                              });
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: areGlobalAxesVisible
                                ? 'var(--cad-color-brand-main)'
                                : 'var(--cad-color-text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px',
                            }}
                            title={areGlobalAxesVisible ? 'Hide All Axes' : 'Show All Axes'}
                          >
                            {areGlobalAxesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                        </div>

                        {axesExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {renderDatumRow(
                              features.find((f) => f.id === 'datum_axis_x'),
                              'X Axis',
                              '12px',
                            )}
                            {renderDatumRow(
                              features.find((f) => f.id === 'datum_axis_y'),
                              'Y Axis',
                              '12px',
                            )}
                            {renderDatumRow(
                              features.find((f) => f.id === 'datum_axis_z'),
                              'Z Axis',
                              '12px',
                            )}
                          </div>
                        )}

                        {/* Planes Folder */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            padding: '2px 8px',
                          }}
                          onClick={() => setPlanesExpanded(!planesExpanded)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {planesExpanded ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--cad-color-text-secondary)',
                              }}
                            >
                              Planes
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              globalPlaneFeatures.forEach((f) => {
                                updateFeature(f.id, { visible: !areGlobalPlanesVisible });
                              });
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: areGlobalPlanesVisible
                                ? 'var(--cad-color-brand-main)'
                                : 'var(--cad-color-text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px',
                            }}
                            title={areGlobalPlanesVisible ? 'Hide All Planes' : 'Show All Planes'}
                          >
                            {areGlobalPlanesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                        </div>

                        {planesExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {renderDatumRow(
                              features.find((f) => f.id === 'datum_plane_xy'),
                              'XY Plane',
                              '12px',
                            )}
                            {renderDatumRow(
                              features.find((f) => f.id === 'datum_plane_yz'),
                              'YZ Plane',
                              '12px',
                            )}
                            {renderDatumRow(
                              features.find((f) => f.id === 'datum_plane_zx'),
                              'ZX Plane',
                              '12px',
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Render Recursive Tree Root Nodes */}
                  {rootUserFeatures.length === 0 ? (
                    <div
                      style={{
                        color: 'var(--cad-color-text-muted)',
                        fontSize: '0.8rem',
                        padding: '12px 6px',
                        textAlign: 'center',
                        border: '1px dashed var(--cad-glass-border-base)',
                        borderRadius: 'var(--cad-radius-sm)',
                      }}
                    >
                      No user features yet. Create sketches, bodies, or parts to begin.
                    </div>
                  ) : (
                    rootUserFeatures.map((feat) => renderFeatureNode(feat, 0))
                  )}
                </div>
              );
            })()}
          </div>

          {renderPropertiesPanel()}
        </div>
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              top: 0,
              right: '-3px',
              width: '6px',
              height: '100%',
              cursor: 'ew-resize',
              zIndex: 20,
              background: 'transparent',
            }}
            className="sidebar-resizer"
          />
        )}
      </aside>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        style={{
          left: isOpen ? `${width}px` : '0px',
          transition: dragging ? 'none' : undefined,
        }}
        title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        aria-label={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </>
  );
}
