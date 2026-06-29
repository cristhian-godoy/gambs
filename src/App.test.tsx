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
      rotation = { x: 0, y: 0, z: 0 };
      position = { x: 0, y: 0, z: 0 };
    },
    AxesHelper: class {},
    Sprite: class {
      position = {
        set(x: number, y: number, z: number) {
          this.x = x;
          this.y = y;
          this.z = z;
        },
        x: 0,
        y: 0,
        z: 0,
      };
      scale = { set: vi.fn() };
      material = { dispose: vi.fn(), map: { dispose: vi.fn() } };
    },
    SpriteMaterial: class {
      dispose = vi.fn();
      map = { dispose: vi.fn() };
    },
    CanvasTexture: class {
      dispose = vi.fn();
    },
    HemisphereLight: class {
      position = { set: vi.fn() };
    },
    DirectionalLight: class {
      position = { set: vi.fn() };
    },
    BoxGeometry: class {
      dispose = vi.fn();
    },
    SphereGeometry: class {
      dispose = vi.fn();
    },
    MeshStandardMaterial: class {
      dispose = vi.fn();
    },
    MeshBasicMaterial: class {
      dispose = vi.fn();
      map = { dispose: vi.fn() };
    },
    Mesh: class {
      add = vi.fn();
      position = {
        set(x: number, y: number, z: number) {
          this.x = x;
          this.y = y;
          this.z = z;
        },
        x: 0,
        y: 0,
        z: 0,
      };
      rotation = { x: 0, y: 0, z: 0 };
      material: unknown;
      constructor(_geometry: unknown, material: unknown) {
        this.material = material;
      }
    },
    EdgesGeometry: class {
      dispose = vi.fn();
    },
    LineBasicMaterial: class {
      dispose = vi.fn();
    },
    LineSegments: class {},
    Line: class {},
    Vector3: class {
      x = 0;
      y = 0;
      z = 0;
      constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
    BufferGeometry: class {
      dispose = vi.fn();
      setFromPoints = vi.fn().mockReturnThis();
      setAttribute = vi.fn();
    },
    PlaneGeometry: class {
      dispose = vi.fn();
    },
    Color: class {},
    DoubleSide: 2,
    MOUSE: {
      NONE: 0,
      ROTATE: 1,
      DOLLY: 2,
      PAN: 3,
    },
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
    expect(screen.getByText(/gambs/i)).toBeInTheDocument();
  });
});
