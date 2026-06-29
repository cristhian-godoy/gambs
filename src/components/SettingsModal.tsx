import { Grid, Monitor, Sliders, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { type AppSettings, useCad } from '../store/CadContext.tsx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingCategory = 'general' | 'navigation' | 'grid';

/**
 * Modal component for viewing and editing global application settings.
 * Renders category navigation on the left pane and setting fields on the right.
 * @returns The rendered SettingsModal component.
 */
export default function SettingsModal({ isOpen, onClose }: SettingsModalProps): ReactNode {
  const { settings, updateSettings } = useCad();
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('general');

  // Local state to hold modifications before applying
  const [localSettings, setLocalSettings] = useState<AppSettings>(() => ({ ...settings }));

  if (!isOpen) return null;

  const handleUpdateLocal = (key: keyof AppSettings, value: unknown) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = () => {
    updateSettings(localSettings);
  };

  const handleOk = () => {
    updateSettings(localSettings);
    onClose();
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal-header">
          <span className="settings-modal-title">Settings</span>
          <button className="settings-close-btn" onClick={onClose} title="Close Settings">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-modal-body">
          {/* Left Sidebar */}
          <div className="settings-modal-sidebar">
            <div className="settings-sidebar-category">Environment</div>
            <div
              className={`settings-sidebar-item ${activeCategory === 'general' ? 'active' : ''}`}
              onClick={() => setActiveCategory('general')}
            >
              <Monitor size={14} />
              General
            </div>

            <div className="settings-sidebar-category">Viewport</div>
            <div
              className={`settings-sidebar-item ${activeCategory === 'navigation' ? 'active' : ''}`}
              onClick={() => setActiveCategory('navigation')}
            >
              <Sliders size={14} />
              Navigation
            </div>
            <div
              className={`settings-sidebar-item ${activeCategory === 'grid' ? 'active' : ''}`}
              onClick={() => setActiveCategory('grid')}
            >
              <Grid size={14} />
              Grid & Snapping
            </div>
          </div>

          {/* Right Content Pane */}
          <div className="settings-modal-content">
            {activeCategory === 'general' && (
              <div>
                <div className="settings-group-title">General Settings</div>
                <div className="settings-form-row">
                  <label htmlFor="setting-theme">Theme Color</label>
                  <select
                    id="setting-theme"
                    value={localSettings.theme}
                    onChange={(e) => handleUpdateLocal('theme', e.target.value)}
                  >
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                  </select>
                </div>
                <div
                  className="settings-form-row checkbox-row"
                  onClick={() => handleUpdateLocal('snapToGrid', !localSettings.snapToGrid)}
                >
                  <input
                    id="setting-snap"
                    type="checkbox"
                    checked={localSettings.snapToGrid}
                    onChange={(e) => handleUpdateLocal('snapToGrid', e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label htmlFor="setting-snap" onClick={(e) => e.stopPropagation()}>
                    Snap cursor to grid in 2D sketcher
                  </label>
                </div>
              </div>
            )}

            {activeCategory === 'navigation' && (
              <div>
                <div className="settings-group-title">3D Navigation & Controls</div>
                <div className="settings-form-row">
                  <label htmlFor="setting-nav">3D Control Profile</label>
                  <select
                    id="setting-nav"
                    value={localSettings.navigationStyle}
                    onChange={(e) => handleUpdateLocal('navigationStyle', e.target.value)}
                  >
                    <option value="default">Default (OrbitControls)</option>
                    <option value="blender">Blender Style</option>
                  </select>
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--cad-color-text-muted)',
                    lineHeight: '1.4',
                    marginTop: '16px',
                  }}
                >
                  {localSettings.navigationStyle === 'default' ? (
                    <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                      <li>
                        <strong>Left Click + Drag</strong>: Rotate viewport
                      </li>
                      <li>
                        <strong>Right Click / Middle Click + Drag</strong>: Pan viewport
                      </li>
                      <li>
                        <strong>Scroll Wheel</strong>: Zoom in and out
                      </li>
                    </ul>
                  ) : (
                    <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                      <li>
                        <strong>Middle Click + Drag</strong>: Rotate viewport
                      </li>
                      <li>
                        <strong>Shift + Middle Click + Drag</strong>: Pan viewport
                      </li>
                      <li>
                        <strong>Scroll Wheel</strong>: Zoom in and out
                      </li>
                      <li>
                        <strong>Left Click</strong>: Object selection & drawing tools
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeCategory === 'grid' && (
              <div>
                <div className="settings-group-title">Grid floor dimensions</div>
                <div className="settings-form-row">
                  <label htmlFor="setting-grid-size">Grid Size (units)</label>
                  <input
                    id="setting-grid-size"
                    type="number"
                    value={localSettings.gridSize}
                    onChange={(e) =>
                      handleUpdateLocal('gridSize', Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>
                <div className="settings-form-row">
                  <label htmlFor="setting-grid-divs">Grid Divisions</label>
                  <input
                    id="setting-grid-divs"
                    type="number"
                    value={localSettings.gridDivisions}
                    onChange={(e) =>
                      handleUpdateLocal('gridDivisions', Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-modal-footer">
          <button className="settings-btn settings-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-btn settings-btn-secondary" onClick={handleApply}>
            Apply
          </button>
          <button className="settings-btn settings-btn-primary" onClick={handleOk}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
