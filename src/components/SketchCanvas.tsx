import { type ReactNode, useEffect, useRef } from 'react';

import type { SketchConstraint } from '../core/solver.ts';
import { useSketchInteraction } from '../hooks/useSketchInteraction.ts';
import { useViewport } from '../hooks/useViewport.ts';
import { useCad } from '../store/CadContext.tsx';
import type { SketchGeometry } from '../store/types.ts';
import {
  type DimensionTextInfo,
  drawConstraints,
  drawGeometries,
  drawGrid,
  drawOrigin,
  drawPreview,
  type Vertex,
} from '../utils/sketchRenderer.ts';

/**
 * Performant 2D sketch canvas with pan, zoom, drawing, selection, and dragging.
 * Supports reference datums, construction geometry, and visual constraint badges/dimensions.
 * @returns The rendered SketchCanvas component.
 */
export default function SketchCanvas(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Consume CAD global state
  const {
    activeTool,
    setActiveTool,
    documentState,
    addSketchGeometry,
    updateFeature,
    selectedElements,
    setSelectedElements,
    updateSketchConstraint,
    settings,
  } = useCad();
  const { activeSketchId, features } = documentState;

  // Viewport and coordinate transform hook
  const { transformRef, coords, setCoords, screenToWorld } = useViewport(canvasRef);

  // Local mutable geometries during dragging to avoid state lag
  const localGeometriesRef = useRef<SketchGeometry[]>([]);

  // Refs for tracking interactive dimension text positions
  const dimensionTextsRef = useRef<DimensionTextInfo[]>([]);

  const previewRef = useRef<SketchGeometry | SketchGeometry[] | null>(null);
  const hoveredGeomIdRef = useRef<string | null>(null);
  const hoveredVertexRef = useRef<Vertex | null>(null);

  // Sync local geometries when CAD store state changes
  useEffect(() => {
    if (activeSketchId) {
      const activeSketch = features.find((f) => f.id === activeSketchId);
      if (activeSketch) {
        localGeometriesRef.current = (activeSketch.params.geometries as SketchGeometry[]) || [];
      }
    } else {
      localGeometriesRef.current = [];
    }
  }, [activeSketchId, features]);

  const requestRedraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeSketch = features.find((f) => f.id === activeSketchId);
    const converged = activeSketch?.params.converged !== false;
    const dof = (activeSketch?.params.dof as number) ?? 1;
    const constraints = (activeSketch?.params.constraints as SketchConstraint[]) || [];

    const brandMainColor =
      settings.theme === 'light' ? 'hsl(217deg 91% 55%)' : 'hsl(217deg 91% 60%)';
    const brandSecondaryColor = 'hsl(172deg 80% 45%)';

    // 1. Draw Grid
    drawGrid(
      ctx,
      canvas.width,
      canvas.height,
      transformRef.current,
      settings,
      selectedElements,
      hoveredGeomIdRef.current,
      brandSecondaryColor,
    );

    // Clear dimension text locations
    dimensionTextsRef.current = [];

    if (activeSketchId) {
      // 2. Draw Geometries
      drawGeometries(
        ctx,
        localGeometriesRef.current,
        selectedElements,
        hoveredGeomIdRef.current,
        hoveredVertexRef.current,
        transformRef.current,
        settings,
        converged,
        dof,
        brandMainColor,
        brandSecondaryColor,
      );

      // 3. Draw Preview
      drawPreview(ctx, previewRef.current, transformRef.current, settings);

      // 4. Draw Constraints
      drawConstraints(
        ctx,
        constraints,
        localGeometriesRef.current,
        transformRef.current,
        settings,
        dimensionTextsRef.current,
      );
    }

    // 5. Draw Origin point
    drawOrigin(
      ctx,
      selectedElements,
      hoveredVertexRef.current,
      transformRef.current,
      settings,
      brandMainColor,
      brandSecondaryColor,
    );
  };

  const requestRedrawRef = useRef(requestRedraw);
  useEffect(() => {
    requestRedrawRef.current = requestRedraw;
  });

  // Bind sketch mouse and keyboard interactions
  useSketchInteraction({
    canvasRef,
    screenToWorld,
    transformRef,
    requestRedraw: () => requestRedrawRef.current(),
    localGeometriesRef,
    dimensionTextsRef,
    setCoords,
    settings,
    activeTool,
    setActiveTool,
    activeSketchId,
    features,
    selectedElements,
    setSelectedElements,
    addSketchGeometry,
    updateSketchConstraint,
    updateFeature,
    previewRef,
    hoveredGeomIdRef,
    hoveredVertexRef,
  });

  // Redraw canvas on state changes
  useEffect(() => {
    requestRedrawRef.current();
  }, [activeSketchId, features, selectedElements, settings]);

  // Set up resize observer and canvas centering
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    transformRef.current.offsetX = rect.width / 2;
    transformRef.current.offsetY = rect.height / 2;
    requestRedrawRef.current();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        requestRedrawRef.current();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [transformRef]);

  return (
    <div ref={containerRef} className="viewport-area">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'var(--cad-glass-bg-base)',
          border: '1px solid var(--cad-glass-border-base)',
          borderRadius: 'var(--cad-radius-sm)',
          padding: '6px 10px',
          fontSize: '0.75rem',
          color: 'var(--cad-color-text-secondary)',
          pointerEvents: 'none',
        }}
      >
        X: {coords.x.toFixed(2)} | Y: {coords.y.toFixed(2)} mm
      </div>
    </div>
  );
}
