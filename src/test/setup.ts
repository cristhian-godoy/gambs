import '@testing-library/jest-dom';

import { vi } from 'vitest';

// Mock ResizeObserver for JSDOM testing
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverMock;
