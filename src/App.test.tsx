import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App.tsx';

// Mock Three.js to run successfully in JSDOM / headless test environment
vi.mock('three', () => {
  const dummyRenderer = {
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    Scene: class {
      background = { set: vi.fn() };
      add = vi.fn();
    },
    PerspectiveCamera: class {
      position = { set: vi.fn() };
    },
    WebGLRenderer: class {
      constructor() {
        return dummyRenderer;
      }
    },
    GridHelper: class {
      rotation = { x: 0 };
    },
    AxesHelper: class {},
    HemisphereLight: class {
      position = { set: vi.fn() };
    },
    DirectionalLight: class {
      position = { set: vi.fn() };
    },
    BoxGeometry: class {
      dispose = vi.fn();
    },
    MeshStandardMaterial: class {
      dispose = vi.fn();
    },
    Mesh: class {
      add = vi.fn();
    },
    EdgesGeometry: class {
      dispose = vi.fn();
    },
    LineBasicMaterial: class {
      dispose = vi.fn();
    },
    LineSegments: class {},
    Color: class {},
  };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  return {
    OrbitControls: class {
      update = vi.fn();
    },
  };
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/SPA CAD/i)).toBeInTheDocument();
  });
});
