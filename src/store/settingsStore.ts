import { useSyncExternalStore } from 'react';

/**
 * Global application settings preferences.
 */
export interface AppSettings {
  navigationStyle: 'default' | 'blender';
  gridSize: number;
  gridDivisions: number;
  snapToGrid: boolean;
  theme: 'dark' | 'light';
  multiSelectMethod: 'click' | 'ctrlClick';
  snapToVertices: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  navigationStyle: 'default',
  gridSize: 100,
  gridDivisions: 20,
  snapToGrid: true,
  theme: 'dark',
  multiSelectMethod: 'ctrlClick',
  snapToVertices: true,
};

type Listener = (settings: AppSettings) => void;

class SettingsStore {
  private settings: AppSettings;
  private listeners = new Set<Listener>();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): AppSettings {
    const stored = localStorage.getItem('gambs_settings');
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        // Ignore
      }
    }
    return DEFAULT_SETTINGS;
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  updateSettings(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('gambs_settings', JSON.stringify(this.settings));
    this.listeners.forEach((listener) => listener(this.settings));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const settingsStore = new SettingsStore();

/**
 * Custom React hook to consume global application settings.
 * @returns The current AppSettings.
 */
export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (callback) => settingsStore.subscribe(callback),
    () => settingsStore.getSettings(),
    () => DEFAULT_SETTINGS,
  );
}
