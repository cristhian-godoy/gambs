import { type RefObject, useRef, useState } from 'react';

/**
 * Viewport transform configuration.
 */
export interface ViewportTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Hook to manage viewport transformations (pan and zoom) on the HTML5 Canvas.
 * @param canvasRef Ref to the HTML5 Canvas element.
 * @returns Viewport state, refs, and transformation utility functions.
 */
export function useViewport(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const transformRef = useRef<ViewportTransform>({
    zoom: 1.0,
    offsetX: 0,
    offsetY: 0,
  });

  const [coords, setCoords] = useState({ x: 0, y: 0 });

  /**
   * Translates screen-space coordinates into world-space coordinates.
   * @param screenX Horizontal position in screen-space.
   * @param screenY Vertical position in screen-space.
   * @returns Horizontal and vertical positions in world-space.
   */
  const screenToWorld = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const { zoom, offsetX, offsetY } = transformRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - offsetX) / zoom;
    const y = -(screenY - rect.top - offsetY) / zoom;
    return { x, y };
  };

  return {
    transformRef,
    coords,
    setCoords,
    screenToWorld,
  };
}
