import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  distance,
  drawCircle,
  drawLine,
  drawRect,
  hitTestCircle,
  hitTestLine,
  hitTestRect,
} from '../core/geometry.ts';
import { useCad } from '../store/CadContext.tsx';
import { SketchGeometry } from '../store/types.ts';

interface Vertex {
  geomId: string;
  type: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  point: { x: number; y: number };
}

/**
 * Performant 2D sketch canvas with pan, zoom, drawing, selection, and dragging.
 * Supports reference datums and construction geometry.
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
    updateFeature,
    selectedGeomIds,
    setSelectedGeomIds,
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

  // Hover state
  const hoveredGeomIdRef = useRef<string | null>(null);
  const hoveredVertexRef = useRef<Vertex | null>(null);

  // Drag modification state
  const isDraggingEntityRef = useRef(false);
  const dragStartWorldRef = useRef<{ x: number; y: number } | null>(null);
  const draggedVertexRef = useRef<Vertex | null>(null);
  const draggedGeomIdRef = useRef<string | null>(null);
  const initialGeomsForDragRef = useRef<SketchGeometry[]>([]);

  // Local mutable geometries during dragging to avoid state lag
  const localGeometriesRef = useRef<SketchGeometry[]>([]);

  // Expose viewport coordinates to UI
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Keep active state in refs to avoid stale closures in event listeners without re-binding overhead
  const stateRef = useRef({
    activeTool,
    activeSketchId,
    features,
    selectedGeomIds,
  });

  useEffect(() => {
    stateRef.current = { activeTool, activeSketchId, features, selectedGeomIds };
    if (!isDraggingEntityRef.current && activeSketchId) {
      const activeSketch = features.find((f) => f.id === activeSketchId);
      if (activeSketch) {
        localGeometriesRef.current = (activeSketch.params.geometries as SketchGeometry[]) || [];
      }
    }
  }, [activeTool, activeSketchId, features, selectedGeomIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Convert screen coordinates to world (sketch) coordinates
    const screenToWorld = (screenX: number, screenY: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (screenX - rect.left - offsetX) / zoom;
      const y = -(screenY - rect.top - offsetY) / zoom;
      return { x, y };
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;
      const { activeSketchId: currentSketchId, selectedGeomIds: currentSelected } =
        stateRef.current;

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, -zoom);

      // Calculate grid spacing based on zoom
      let gridSpacing = 10;
      const minPixelSpacing = 30;

      while (gridSpacing * zoom < minPixelSpacing) {
        gridSpacing *= 5;
      }
      while (gridSpacing * zoom > minPixelSpacing * 5) {
        gridSpacing /= 2;
      }

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

      // Draw Major Axes (with Hover & Selection highlights)
      // X axis (Red)
      const isXSelected = currentSelected.includes('datum_axis_x');
      const isXHovered = hoveredGeomIdRef.current === 'datum_axis_x';
      if (isXSelected) {
        ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
        ctx.lineWidth = 3 / zoom;
      } else if (isXHovered) {
        ctx.strokeStyle = 'hsl(45deg 100% 50%)';
        ctx.lineWidth = 2.5 / zoom;
      } else {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2 / zoom;
      }
      ctx.beginPath();
      ctx.moveTo(leftWorld, 0);
      ctx.lineTo(rightWorld, 0);
      ctx.stroke();

      // Y axis (Green)
      const isYSelected = currentSelected.includes('datum_axis_y');
      const isYHovered = hoveredGeomIdRef.current === 'datum_axis_y';
      if (isYSelected) {
        ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
        ctx.lineWidth = 3 / zoom;
      } else if (isYHovered) {
        ctx.strokeStyle = 'hsl(45deg 100% 50%)';
        ctx.lineWidth = 2.5 / zoom;
      } else {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 2 / zoom;
      }
      ctx.beginPath();
      ctx.moveTo(0, bottomWorld);
      ctx.lineTo(0, topWorld);
      ctx.stroke();

      // Draw active sketch geometries
      if (currentSketchId) {
        const geometries = localGeometriesRef.current;
        for (const geom of geometries) {
          const isSelected = currentSelected.includes(geom.id);
          const isHovered = hoveredGeomIdRef.current === geom.id;

          // Set drawing styles based on whether it is a construction line or standard geometry
          if (geom.isConstruction) {
            ctx.setLineDash([6 / zoom, 4 / zoom]);
            ctx.lineWidth = 1.5 / zoom;
            if (isSelected) {
              ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
            } else if (isHovered) {
              ctx.strokeStyle = 'hsl(45deg 100% 50%)';
            } else {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            }
          } else {
            ctx.setLineDash([]);
            if (isSelected) {
              ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
              ctx.lineWidth = 3 / zoom;
            } else if (isHovered) {
              ctx.strokeStyle = 'hsl(45deg 100% 50%)';
              ctx.lineWidth = 2.5 / zoom;
            } else {
              ctx.strokeStyle = 'var(--cad-color-brand-main)';
              ctx.lineWidth = 2 / zoom;
            }
          }

          if (geom.type === 'line') drawLine(ctx, geom);
          else if (geom.type === 'circle') drawCircle(ctx, geom);
          else if (geom.type === 'rect') drawRect(ctx, geom);

          // Reset dash
          ctx.setLineDash([]);

          // Draw vertices
          const vertices: Vertex[] = [];
          if (geom.type === 'line') {
            vertices.push({ geomId: geom.id, type: 'start', point: geom.start });
            vertices.push({ geomId: geom.id, type: 'end', point: geom.end });
          } else if (geom.type === 'circle') {
            vertices.push({ geomId: geom.id, type: 'center', point: geom.center });
          } else if (geom.type === 'rect') {
            vertices.push({ geomId: geom.id, type: 'start', point: geom.start });
            vertices.push({ geomId: geom.id, type: 'end', point: geom.end });
            vertices.push({
              geomId: geom.id,
              type: 'corner1',
              point: { x: geom.end.x, y: geom.start.y },
            });
            vertices.push({
              geomId: geom.id,
              type: 'corner2',
              point: { x: geom.start.x, y: geom.end.y },
            });
          }

          for (const vert of vertices) {
            const isVertHovered =
              hoveredVertexRef.current &&
              hoveredVertexRef.current.geomId === vert.geomId &&
              hoveredVertexRef.current.type === vert.type;

            if (isVertHovered) {
              ctx.fillStyle = 'hsl(45deg 100% 50%)';
              ctx.beginPath();
              ctx.arc(vert.point.x, vert.point.y, 6 / zoom, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = isSelected
                ? 'var(--cad-color-brand-secondary)'
                : geom.isConstruction
                  ? 'rgba(255, 255, 255, 0.4)'
                  : 'var(--cad-color-brand-main)';
              ctx.beginPath();
              ctx.arc(vert.point.x, vert.point.y, 4 / zoom, 0, Math.PI * 2);
              ctx.fill();
            }
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

      // Draw Origin point (with Hover & Selection highlights)
      const isOriginSelected = currentSelected.includes('datum_origin');
      const isOriginHovered =
        hoveredVertexRef.current && hoveredVertexRef.current.geomId === 'datum_origin';

      if (isOriginSelected) {
        ctx.fillStyle = 'var(--cad-color-brand-secondary)';
        ctx.beginPath();
        ctx.arc(0, 0, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();
      } else if (isOriginHovered) {
        ctx.fillStyle = 'hsl(45deg 100% 50%)';
        ctx.beginPath();
        ctx.arc(0, 0, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'var(--cad-color-brand-main)';
        ctx.beginPath();
        ctx.arc(0, 0, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }

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

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        requestRedraw();
      }
    });
    resizeObserver.observe(container);

    // Mouse events for pan, zoom, drawing, selection, and drag modification
    const handleMouseDown = (e: MouseEvent) => {
      const {
        activeTool: currentTool,
        activeSketchId: currentSketchId,
        selectedGeomIds: currentSelected,
      } = stateRef.current;

      // Pan on middle mouse click or shift + left click
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanningRef.current = true;
        startDragRef.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      // Handle Select & Drag Modification trigger
      if (e.button === 0 && currentTool === 'select') {
        const worldPos = screenToWorld(e.clientX, e.clientY);

        // Click down on hovered vertex or geometry -> start dragging! (except fixed virtual datums)
        if (hoveredVertexRef.current || hoveredGeomIdRef.current) {
          const isDatum =
            hoveredGeomIdRef.current?.startsWith('datum_') ||
            hoveredVertexRef.current?.geomId.startsWith('datum_');

          if (!isDatum) {
            isDraggingEntityRef.current = true;
            dragStartWorldRef.current = worldPos;
            initialGeomsForDragRef.current = JSON.parse(JSON.stringify(localGeometriesRef.current));

            if (hoveredVertexRef.current) {
              draggedVertexRef.current = { ...hoveredVertexRef.current };
              draggedGeomIdRef.current = null;
            } else {
              draggedGeomIdRef.current = hoveredGeomIdRef.current;
              draggedVertexRef.current = null;
            }
          }

          // Handle Selection update
          const targetId = hoveredVertexRef.current
            ? hoveredVertexRef.current.geomId
            : hoveredGeomIdRef.current!;

          if (e.ctrlKey || e.shiftKey) {
            if (currentSelected.includes(targetId)) {
              setSelectedGeomIds(currentSelected.filter((id) => id !== targetId));
            } else {
              setSelectedGeomIds([...currentSelected, targetId]);
            }
          } else {
            if (!currentSelected.includes(targetId)) {
              setSelectedGeomIds([targetId]);
            }
          }
          e.preventDefault();
        } else {
          // click empty space -> clear selection
          if (!e.ctrlKey && !e.shiftKey) {
            setSelectedGeomIds([]);
          }
        }
        return;
      }

      // Handle drawing triggers
      if (e.button === 0 && currentTool !== 'select') {
        const worldPos = screenToWorld(e.clientX, e.clientY);

        let sketchId = currentSketchId;
        if (!sketchId) {
          sketchId = addFeature('sketch', 'Sketch 1', { geometries: [], constraints: [] }, []);
          enterSketchEdit(sketchId);
          stateRef.current.activeSketchId = sketchId;
        }

        if (!isDrawingRef.current) {
          isDrawingRef.current = true;
          drawingStartRef.current = worldPos;
        } else {
          const start = drawingStartRef.current!;
          const id = `${currentTool}_${Date.now()}`;

          if (currentTool === 'line') {
            addSketchGeometry({
              type: 'line',
              id,
              start,
              end: worldPos,
            });
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
      const { activeTool: currentTool, activeSketchId: currentSketchId } = stateRef.current;
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

      // Handle Drag Modification
      if (isDraggingEntityRef.current && currentSketchId) {
        const start = dragStartWorldRef.current!;
        const dx = worldPos.x - start.x;
        const dy = worldPos.y - start.y;

        const nextGeoms = initialGeomsForDragRef.current.map((geom) => {
          if (draggedVertexRef.current && draggedVertexRef.current.geomId === geom.id) {
            const vType = draggedVertexRef.current.type;
            if (geom.type === 'line') {
              return {
                ...geom,
                start:
                  vType === 'start' ? { x: geom.start.x + dx, y: geom.start.y + dy } : geom.start,
                end: vType === 'end' ? { x: geom.end.x + dx, y: geom.end.y + dy } : geom.end,
              };
            } else if (geom.type === 'circle') {
              return {
                ...geom,
                center:
                  vType === 'center'
                    ? { x: geom.center.x + dx, y: geom.center.y + dy }
                    : geom.center,
              };
            } else if (geom.type === 'rect') {
              const startCorner = geom.start;
              const endCorner = geom.end;
              return {
                ...geom,
                start:
                  vType === 'start'
                    ? { x: startCorner.x + dx, y: startCorner.y + dy }
                    : startCorner,
                end: vType === 'end' ? { x: endCorner.x + dx, y: endCorner.y + dy } : endCorner,
              };
            }
          }

          if (draggedGeomIdRef.current === geom.id) {
            if (geom.type === 'line') {
              return {
                ...geom,
                start: { x: geom.start.x + dx, y: geom.start.y + dy },
                end: { x: geom.end.x + dx, y: geom.end.y + dy },
              };
            } else if (geom.type === 'circle') {
              return {
                ...geom,
                center: { x: geom.center.x + dx, y: geom.center.y + dy },
              };
            } else if (geom.type === 'rect') {
              return {
                ...geom,
                start: { x: geom.start.x + dx, y: geom.start.y + dy },
                end: { x: geom.end.x + dx, y: geom.end.y + dy },
              };
            }
          }

          return geom;
        });

        localGeometriesRef.current = nextGeoms;
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
        return;
      }

      // Handle Hover Calculations in select mode (including virtual datums)
      if (currentTool === 'select' && currentSketchId) {
        const { zoom } = transformRef.current;
        const toleranceInWorld = 8 / zoom;

        let hitVertex: Vertex | null = null;
        let hitGeomId: string | null = null;

        if (distance(worldPos, { x: 0, y: 0 }) <= toleranceInWorld) {
          hitVertex = { geomId: 'datum_origin', type: 'center', point: { x: 0, y: 0 } };
        }

        if (!hitVertex) {
          if (Math.abs(worldPos.y) <= toleranceInWorld) {
            hitGeomId = 'datum_axis_x';
          } else if (Math.abs(worldPos.x) <= toleranceInWorld) {
            hitGeomId = 'datum_axis_y';
          }
        }

        if (!hitVertex && !hitGeomId) {
          for (const geom of localGeometriesRef.current) {
            // Check vertices
            if (geom.type === 'line') {
              if (distance(worldPos, geom.start) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'start', point: geom.start };
                break;
              }
              if (distance(worldPos, geom.end) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'end', point: geom.end };
                break;
              }
            } else if (geom.type === 'circle') {
              if (distance(worldPos, geom.center) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'center', point: geom.center };
                break;
              }
            } else if (geom.type === 'rect') {
              if (distance(worldPos, geom.start) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'start', point: geom.start };
                break;
              }
              if (distance(worldPos, geom.end) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'end', point: geom.end };
                break;
              }
            }

            // Check boundaries
            if (geom.type === 'line' && hitTestLine(worldPos, geom, toleranceInWorld)) {
              hitGeomId = geom.id;
            } else if (geom.type === 'circle' && hitTestCircle(worldPos, geom, toleranceInWorld)) {
              hitGeomId = geom.id;
            } else if (geom.type === 'rect' && hitTestRect(worldPos, geom, toleranceInWorld)) {
              hitGeomId = geom.id;
            }
          }
        }

        const statusChanged =
          hoveredGeomIdRef.current !== hitGeomId ||
          JSON.stringify(hoveredVertexRef.current) !== JSON.stringify(hitVertex);

        if (statusChanged) {
          hoveredGeomIdRef.current = hitGeomId;
          hoveredVertexRef.current = hitVertex;
          canvas.style.cursor = hitVertex || hitGeomId ? 'pointer' : 'default';
          requestRedraw();
        }
      }
    };

    const handleMouseUp = () => {
      const { activeSketchId: currentSketchId } = stateRef.current;

      if (isDraggingEntityRef.current) {
        isDraggingEntityRef.current = false;
        dragStartWorldRef.current = null;
        draggedVertexRef.current = null;
        draggedGeomIdRef.current = null;

        if (currentSketchId) {
          updateFeature(currentSketchId, { geometries: localGeometriesRef.current });
        }
      }

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
  }, [
    addFeature,
    enterSketchEdit,
    addSketchGeometry,
    updateFeature,
    setSelectedGeomIds,
    setActiveTool,
  ]);

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
