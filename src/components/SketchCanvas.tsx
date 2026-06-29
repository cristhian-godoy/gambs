import { type ReactNode, useEffect, useRef, useState } from 'react';

import { drawCircle, drawLine, drawRect } from '../core/geometry.ts';
import { useCad } from '../store/CadContext.tsx';
import { SketchGeometry } from '../store/types.ts';

/**
 * Performant 2D sketch canvas with pan, zoom, and interactive drawing tools.
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
    addFeature,
    enterSketchEdit,
    addSketchGeometry,
  } = useCad();
  const { activeSketchId, features } = documentState;

  // Viewport transforms stored in refs for 60fps rendering without React bottleneck
  const transformRef = useRef({
    zoom: 1.0,
    offsetX: 0,
    offsetY: 0,
  });

  const isPanningRef = useRef(false);
  const startDragRef = useRef({ x: 0, y: 0 });

  // Drawing state
  const isDrawingRef = useRef(false);
  const drawingStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<SketchGeometry | null>(null);

  // Expose viewport coordinates to UI
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Keep active state in refs to avoid stale closures in event listeners without re-binding overhead
  const stateRef = useRef({
    activeTool,
    activeSketchId,
    features,
  });

  useEffect(() => {
    stateRef.current = { activeTool, activeSketchId, features };
  }, [activeTool, activeSketchId, features]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Convert screen coordinates to world (sketch) coordinates
    const screenToWorld = (screenX: number, screenY: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (screenX - rect.left - offsetX) / zoom;
      const y = -(screenY - rect.top - offsetY) / zoom; // invert Y for standard Cartesian coordinates
      return { x, y };
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;
      const { activeSketchId: currentSketchId, features: currentFeatures } = stateRef.current;

      ctx.clearRect(0, 0, width, height);

      // Apply viewport transform
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, -zoom); // Invert Y axis for positive Y going up

      // Calculate grid spacing based on zoom
      let gridSpacing = 10; // 10mm
      const minPixelSpacing = 30;

      while (gridSpacing * zoom < minPixelSpacing) {
        gridSpacing *= 5;
      }
      while (gridSpacing * zoom > minPixelSpacing * 5) {
        gridSpacing /= 2;
      }

      // Determine grid bounds in world coordinates
      const leftWorld = -offsetX / zoom;
      const rightWorld = (width - offsetX) / zoom;
      const topWorld = offsetY / zoom;
      const bottomWorld = -(height - offsetY) / zoom;

      // Start drawing grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1 / zoom;

      const startX = Math.floor(leftWorld / gridSpacing) * gridSpacing;
      const endX = Math.ceil(rightWorld / gridSpacing) * gridSpacing;
      for (let x = startX; x <= endX; x += gridSpacing) {
        if (Math.abs(x) < 0.001) continue;
        ctx.beginPath();
        ctx.moveTo(x, bottomWorld);
        ctx.lineTo(x, topWorld);
        ctx.stroke();
      }

      const startY = Math.floor(bottomWorld / gridSpacing) * gridSpacing;
      const endY = Math.ceil(topWorld / gridSpacing) * gridSpacing;
      for (let y = startY; y <= endY; y += gridSpacing) {
        if (Math.abs(y) < 0.001) continue;
        ctx.beginPath();
        ctx.moveTo(leftWorld, y);
        ctx.lineTo(rightWorld, y);
        ctx.stroke();
      }

      // Draw Major Axes
      // X axis (Red)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(leftWorld, 0);
      ctx.lineTo(rightWorld, 0);
      ctx.stroke();

      // Y axis (Green)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, bottomWorld);
      ctx.lineTo(0, topWorld);
      ctx.stroke();

      // Draw active sketch geometries
      if (currentSketchId) {
        const activeSketch = currentFeatures.find((f) => f.id === currentSketchId);
        if (activeSketch) {
          const geometries = (activeSketch.params.geometries as SketchGeometry[]) || [];
          ctx.strokeStyle = 'var(--cad-color-brand-main)'; // brand blue for drawn shapes
          ctx.lineWidth = 2 / zoom;
          for (const geom of geometries) {
            if (geom.type === 'line') drawLine(ctx, geom);
            else if (geom.type === 'circle') drawCircle(ctx, geom);
            else if (geom.type === 'rect') drawRect(ctx, geom);
          }
        }
      }

      // Draw drawing preview
      if (previewRef.current) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        const geom = previewRef.current;
        if (geom.type === 'line') drawLine(ctx, geom);
        else if (geom.type === 'circle') drawCircle(ctx, geom);
        else if (geom.type === 'rect') drawRect(ctx, geom);
        ctx.setLineDash([]);
      }

      // Draw Origin point
      ctx.fillStyle = 'var(--cad-color-brand-main)';
      ctx.beginPath();
      ctx.arc(0, 0, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const requestRedraw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawGrid(ctx, canvas.width, canvas.height);
    };

    // Set initial offset to center of screen
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    transformRef.current.offsetX = rect.width / 2;
    transformRef.current.offsetY = rect.height / 2;

    requestRedraw();

    // Resize handler
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        requestRedraw();
      }
    });
    resizeObserver.observe(container);

    // Mouse events for pan, zoom, & drawing
    const handleMouseDown = (e: MouseEvent) => {
      const { activeTool: currentTool, activeSketchId: currentSketchId } = stateRef.current;

      // Pan on middle mouse click or shift + left click
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanningRef.current = true;
        startDragRef.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      // Handle drawing triggers
      if (e.button === 0 && currentTool !== 'select') {
        const worldPos = screenToWorld(e.clientX, e.clientY);

        // Ensure a sketch feature exists and is active
        let sketchId = currentSketchId;
        if (!sketchId) {
          sketchId = addFeature('sketch', 'Sketch 1', { geometries: [], constraints: [] }, []);
          enterSketchEdit(sketchId);
          // Update ref manually to use it in this execution block
          stateRef.current.activeSketchId = sketchId;
        }

        if (!isDrawingRef.current) {
          // Click 1: start drawing
          isDrawingRef.current = true;
          drawingStartRef.current = worldPos;
        } else {
          // Click 2: commit geometry
          const start = drawingStartRef.current!;
          const id = `${currentTool}_${Date.now()}`;

          if (currentTool === 'line') {
            addSketchGeometry({
              type: 'line',
              id,
              start,
              end: worldPos,
            });
            // Polyline support: next line starts at this endpoint
            drawingStartRef.current = worldPos;
            previewRef.current = {
              type: 'line',
              id: `preview_${Date.now()}`,
              start: worldPos,
              end: worldPos,
            };
          } else if (currentTool === 'circle') {
            const dx = worldPos.x - start.x;
            const dy = worldPos.y - start.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            addSketchGeometry({
              type: 'circle',
              id,
              center: start,
              radius,
            });
            // Finish drawing
            isDrawingRef.current = false;
            drawingStartRef.current = null;
            previewRef.current = null;
          } else if (currentTool === 'rect') {
            addSketchGeometry({
              type: 'rect',
              id,
              start,
              end: worldPos,
            });
            // Finish drawing
            isDrawingRef.current = false;
            drawingStartRef.current = null;
            previewRef.current = null;
          }

          requestRedraw();
        }
      }

      // Stop polyline chain on right click
      if (e.button === 2) {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          drawingStartRef.current = null;
          previewRef.current = null;
          requestRedraw();
          e.preventDefault();
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { activeTool: currentTool } = stateRef.current;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setCoords({ x: worldPos.x, y: worldPos.y });

      // Handle pan offset
      if (isPanningRef.current) {
        const dx = e.clientX - startDragRef.current.x;
        const dy = e.clientY - startDragRef.current.y;
        transformRef.current.offsetX += dx;
        transformRef.current.offsetY += dy;
        startDragRef.current = { x: e.clientX, y: e.clientY };
        requestRedraw();
        return;
      }

      // Handle drawing previews
      if (isDrawingRef.current && currentTool !== 'select') {
        const start = drawingStartRef.current!;
        const previewId = `preview_${Date.now()}`;

        if (currentTool === 'line') {
          previewRef.current = {
            type: 'line',
            id: previewId,
            start,
            end: worldPos,
          };
        } else if (currentTool === 'circle') {
          const dx = worldPos.x - start.x;
          const dy = worldPos.y - start.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          previewRef.current = {
            type: 'circle',
            id: previewId,
            center: start,
            radius,
          };
        } else if (currentTool === 'rect') {
          previewRef.current = {
            type: 'rect',
            id: previewId,
            start,
            end: worldPos,
          };
        }
        requestRedraw();
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.style.cursor = 'default';
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const { zoom, offsetX, offsetY } = transformRef.current;

      const mouseRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - mouseRect.left;
      const mouseY = e.clientY - mouseRect.top;

      // Mouse pos in world coordinates before zoom
      const worldX = (mouseX - offsetX) / zoom;
      const worldY = -(mouseY - offsetY) / zoom;

      let newZoom = zoom;
      if (e.deltaY < 0) {
        newZoom *= zoomFactor;
      } else {
        newZoom /= zoomFactor;
      }

      newZoom = Math.max(0.1, Math.min(newZoom, 50));

      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY + worldY * newZoom;

      transformRef.current.zoom = newZoom;
      transformRef.current.offsetX = newOffsetX;
      transformRef.current.offsetY = newOffsetY;

      requestRedraw();
    };

    // Keyboard handlers (Escape to cancel drawing)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          drawingStartRef.current = null;
          previewRef.current = null;
          requestRedraw();
        } else {
          setActiveTool('select');
        }
      }
    };

    // Prevent context menu to allow standard CAD right-click operations
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [addFeature, enterSketchEdit, addSketchGeometry, setActiveTool]);

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
