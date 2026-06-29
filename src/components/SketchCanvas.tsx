import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  distance,
  drawArc,
  drawCircle,
  drawLine,
  drawRect,
  hitTestArc,
  hitTestCircle,
  hitTestLine,
  hitTestRect,
} from '../core/geometry.ts';
import type { SketchConstraint } from '../core/solver.ts';
import { useCad } from '../store/CadContext.tsx';
import type { SketchGeometry } from '../store/types.ts';

interface Vertex {
  geomId: string;
  type: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  point: { x: number; y: number };
}

interface DimensionTextInfo {
  id: string;
  x: number;
  y: number;
  value: number;
}

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
    addFeature,
    enterSketchEdit,
    addSketchGeometry,
    updateFeature,
    selectedElements,
    setSelectedElements,
    updateSketchConstraint,
    settings,
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
  const previewRef = useRef<SketchGeometry | SketchGeometry[] | null>(null);

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

  // Refs for tracking interactive dimension text positions
  const dimensionTextsRef = useRef<DimensionTextInfo[]>([]);

  // Expose viewport coordinates to UI
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Keep active state in refs to avoid stale closures in event listeners without re-binding overhead
  const stateRef = useRef({
    activeTool,
    activeSketchId,
    features,
    selectedElements,
  });

  useEffect(() => {
    stateRef.current = { activeTool, activeSketchId, features, selectedElements };
    if (!isDraggingEntityRef.current && activeSketchId) {
      const activeSketch = features.find((f) => f.id === activeSketchId);
      if (activeSketch) {
        localGeometriesRef.current = (activeSketch.params.geometries as SketchGeometry[]) || [];
      }
    }
  }, [activeTool, activeSketchId, features, selectedElements]);

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

    // Helper to resolve point coordinates from constraint targets
    const resolvePointCoords = (
      target: {
        geomId: string;
        vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
      },
      geomsList: SketchGeometry[],
    ) => {
      const { geomId, vertexType } = target;
      if (geomId === 'datum_origin') return { x: 0, y: 0 };
      const geom = geomsList.find((g) => g.id === geomId);
      if (!geom) return { x: 0, y: 0 };
      if (geom.type === 'line') {
        return vertexType === 'start' ? geom.start : geom.end;
      }
      if (geom.type === 'circle') {
        return geom.center;
      }
      if (geom.type === 'rect') {
        if (vertexType === 'start') return geom.start;
        if (vertexType === 'end') return geom.end;
        if (vertexType === 'corner1') return { x: geom.end.x, y: geom.start.y };
        return { x: geom.start.x, y: geom.end.y };
      }
      return { x: 0, y: 0 };
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;
      const {
        activeSketchId: currentSketchId,
        selectedElements: currentSelected,
        features: currentFeatures,
      } = stateRef.current;

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
      ctx.strokeStyle =
        settings.theme === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
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
      const isXSelected = currentSelected.some((el) => el.geomId === 'datum_axis_x');
      const isXHovered = hoveredGeomIdRef.current === 'datum_axis_x';
      if (isXSelected) {
        ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
        ctx.lineWidth = 3 / zoom;
      } else if (isXHovered) {
        ctx.strokeStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
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
      const isYSelected = currentSelected.some((el) => el.geomId === 'datum_axis_y');
      const isYHovered = hoveredGeomIdRef.current === 'datum_axis_y';
      if (isYSelected) {
        ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
        ctx.lineWidth = 3 / zoom;
      } else if (isYHovered) {
        ctx.strokeStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
        ctx.lineWidth = 2.5 / zoom;
      } else {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 2 / zoom;
      }
      ctx.beginPath();
      ctx.moveTo(0, bottomWorld);
      ctx.lineTo(0, topWorld);
      ctx.stroke();

      // Clear interactive text locations
      dimensionTextsRef.current = [];

      // Draw active sketch geometries & constraints
      if (currentSketchId) {
        const activeSketch = currentFeatures.find((f) => f.id === currentSketchId);
        const converged = activeSketch?.params.converged !== false;
        const dof = (activeSketch?.params.dof as number) ?? 1;

        const geometries = localGeometriesRef.current;
        for (const geom of geometries) {
          const isSelected = currentSelected.some(
            (el) => el.geomId === geom.id && el.vertexType === undefined,
          );
          const isHovered = hoveredGeomIdRef.current === geom.id;

          // Set drawing styles based on whether it is a construction line or standard geometry
          if (geom.isConstruction) {
            ctx.setLineDash([6 / zoom, 4 / zoom]);
            ctx.lineWidth = 1.5 / zoom;
            if (isSelected) {
              ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
            } else if (isHovered) {
              ctx.strokeStyle =
                settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
            } else {
              ctx.strokeStyle =
                settings.theme === 'light' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.25)';
            }
          } else {
            ctx.setLineDash([]);
            if (isSelected) {
              ctx.strokeStyle = 'var(--cad-color-brand-secondary)';
              ctx.lineWidth = 3 / zoom;
            } else if (isHovered) {
              ctx.strokeStyle =
                settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
              ctx.lineWidth = 2.5 / zoom;
            } else if (!converged) {
              // Red for over-constrained/conflict
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2 / zoom;
            } else if (dof === 0) {
              // Green for fully-constrained
              ctx.strokeStyle = '#22c55e';
              ctx.lineWidth = 2 / zoom;
            } else {
              ctx.strokeStyle = 'var(--cad-color-brand-main)';
              ctx.lineWidth = 2 / zoom;
            }
          }

          if (geom.type === 'line') drawLine(ctx, geom);
          else if (geom.type === 'circle') drawCircle(ctx, geom);
          else if (geom.type === 'rect') drawRect(ctx, geom);
          else if (geom.type === 'arc') drawArc(ctx, geom);

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
          } else if (geom.type === 'arc') {
            vertices.push({ geomId: geom.id, type: 'center', point: geom.center });
            vertices.push({
              geomId: geom.id,
              type: 'start',
              point: {
                x: geom.center.x + geom.radius * Math.cos(geom.startAngle),
                y: geom.center.y + geom.radius * Math.sin(geom.startAngle),
              },
            });
            vertices.push({
              geomId: geom.id,
              type: 'end',
              point: {
                x: geom.center.x + geom.radius * Math.cos(geom.endAngle),
                y: geom.center.y + geom.radius * Math.sin(geom.endAngle),
              },
            });
          }

          for (const vert of vertices) {
            const isVertHovered =
              hoveredVertexRef.current &&
              hoveredVertexRef.current.geomId === vert.geomId &&
              hoveredVertexRef.current.type === vert.type;

            const isVertSelected = currentSelected.some(
              (el) => el.geomId === vert.geomId && el.vertexType === vert.type,
            );

            if (isVertHovered) {
              ctx.fillStyle =
                settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
              ctx.beginPath();
              ctx.arc(vert.point.x, vert.point.y, 6 / zoom, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = isVertSelected
                ? 'var(--cad-color-brand-secondary)'
                : geom.isConstruction
                  ? settings.theme === 'light'
                    ? 'rgba(0, 0, 0, 0.4)'
                    : 'rgba(255, 255, 255, 0.4)'
                  : 'var(--cad-color-brand-main)';
              ctx.beginPath();
              ctx.arc(vert.point.x, vert.point.y, 4 / zoom, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Draw active drawing preview
        if (previewRef.current) {
          const drawSinglePreview = (g: SketchGeometry) => {
            ctx.save();
            ctx.strokeStyle =
              settings.theme === 'light' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.55)';
            ctx.lineWidth = 2 / zoom;
            ctx.setLineDash([5 / zoom, 5 / zoom]);
            if (g.type === 'line') drawLine(ctx, g);
            else if (g.type === 'circle') drawCircle(ctx, g);
            else if (g.type === 'rect') drawRect(ctx, g);
            else if (g.type === 'arc') drawArc(ctx, g);
            ctx.restore();
          };

          if (Array.isArray(previewRef.current)) {
            previewRef.current.forEach(drawSinglePreview);
          } else {
            drawSinglePreview(previewRef.current as SketchGeometry);
          }
        }

        // Draw constraint badges and dimension lines
        const constraints = (activeSketch?.params.constraints as SketchConstraint[]) || [];

        // Helper to draw clean text right-side-up on transformed canvas
        const drawTextBadge = (
          text: string,
          x: number,
          y: number,
          color = settings.theme === 'light' ? '#0f172a' : '#e2e8f0',
          size = 10,
        ) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1 / zoom, -1 / zoom); // counteract inverted Y scaling

          ctx.fillStyle =
            settings.theme === 'light' ? 'rgba(241, 245, 249, 0.9)' : 'rgba(20, 20, 20, 0.85)';
          ctx.strokeStyle =
            settings.theme === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;

          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(-textWidth / 2 - 4, -size / 2 - 3, textWidth + 8, size + 6);
          ctx.strokeRect(-textWidth / 2 - 4, -size / 2 - 3, textWidth + 8, size + 6);

          ctx.fillStyle = color;
          ctx.font = `bold ${size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 0, 0);
          ctx.restore();
        };

        for (const c of constraints) {
          if (c.type === 'horizontal') {
            const line = geometries.find((g) => g.id === c.targets[0].geomId);
            if (line && line.type === 'line') {
              const mx = (line.start.x + line.end.x) / 2;
              const my = (line.start.y + line.end.y) / 2;
              drawTextBadge(
                'H',
                mx,
                my + 15 / zoom,
                settings.theme === 'light' ? '#1d4ed8' : '#60a5fa',
              );
            }
          } else if (c.type === 'vertical') {
            const line = geometries.find((g) => g.id === c.targets[0].geomId);
            if (line && line.type === 'line') {
              const mx = (line.start.x + line.end.x) / 2;
              const my = (line.start.y + line.end.y) / 2;
              drawTextBadge(
                'V',
                mx + 15 / zoom,
                my,
                settings.theme === 'light' ? '#047857' : '#34d399',
              );
            }
          } else if (c.type === 'distance') {
            const p1 = resolvePointCoords(c.targets[0], geometries);
            const p2 = resolvePointCoords(c.targets[1], geometries);

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len > 1e-4) {
              const nx = -dy / len;
              const ny = dx / len;
              const offsetDist = 20 / zoom; // offset distance from shape

              const ox = mx + nx * offsetDist;
              const oy = my + ny * offsetDist;

              // Draw thin dimension guide lines
              ctx.strokeStyle = settings.theme === 'light' ? '#b45309' : '#f59e0b'; // amber color for dimensions
              ctx.lineWidth = 1 / zoom;
              ctx.setLineDash([3 / zoom, 3 / zoom]);

              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p1.x + nx * offsetDist, p1.y + ny * offsetDist);
              ctx.moveTo(p2.x, p2.y);
              ctx.lineTo(p2.x + nx * offsetDist, p2.y + ny * offsetDist);
              ctx.stroke();

              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(p1.x + nx * offsetDist, p1.y + ny * offsetDist);
              ctx.lineTo(p2.x + nx * offsetDist, p2.y + ny * offsetDist);
              ctx.stroke();

              // Draw distance value badge
              const val = c.value !== undefined ? c.value : len;
              drawTextBadge(
                `${val.toFixed(1)} mm`,
                ox,
                oy,
                settings.theme === 'light' ? '#b45309' : '#f59e0b',
                10,
              );

              // Record coordinates for double click editing
              dimensionTextsRef.current.push({ id: c.id, x: ox, y: oy, value: val });
            }
          } else if (c.type === 'radius') {
            const circle = geometries.find((g) => g.id === c.targets[0].geomId);
            if (circle && circle.type === 'circle') {
              const theta = Math.PI / 4; // 45 degrees leader line direction
              const ox = circle.center.x + (circle.radius + 15 / zoom) * Math.cos(theta);
              const oy = circle.center.y + (circle.radius + 15 / zoom) * Math.sin(theta);

              ctx.strokeStyle = settings.theme === 'light' ? '#b45309' : '#f59e0b';
              ctx.lineWidth = 1 / zoom;
              ctx.beginPath();
              ctx.moveTo(
                circle.center.x + circle.radius * Math.cos(theta),
                circle.center.y + circle.radius * Math.sin(theta),
              );
              ctx.lineTo(ox, oy);
              ctx.stroke();

              const val = c.value !== undefined ? c.value : circle.radius;
              drawTextBadge(
                `R ${val.toFixed(1)}`,
                ox,
                oy,
                settings.theme === 'light' ? '#b45309' : '#f59e0b',
                10,
              );

              dimensionTextsRef.current.push({ id: c.id, x: ox, y: oy, value: val });
            }
          } else if (c.type === 'angle') {
            const g1 = geometries.find((g) => g.id === c.targets[0].geomId);
            const g2 = geometries.find((g) => g.id === c.targets[1].geomId);
            if (g1 && g2 && g1.type === 'line' && g2.type === 'line') {
              // Draw badge in the average midpoint area
              const mx1 = (g1.start.x + g1.end.x) / 2;
              const my1 = (g1.start.y + g1.end.y) / 2;
              const mx2 = (g2.start.x + g2.end.x) / 2;
              const my2 = (g2.start.y + g2.end.y) / 2;

              const ax = (mx1 + mx2) / 2;
              const ay = (my1 + my2) / 2;

              const valRad = c.value !== undefined ? c.value : Math.PI / 2;
              const valDeg = (valRad * 180) / Math.PI;

              drawTextBadge(
                `${valDeg.toFixed(1)}°`,
                ax,
                ay,
                settings.theme === 'light' ? '#b45309' : '#f59e0b',
                10,
              );

              dimensionTextsRef.current.push({ id: c.id, x: ax, y: ay, value: valDeg });
            }
          }
        }
      }

      // Draw Origin point (with Hover & Selection highlights)
      const isOriginSelected = currentSelected.some((el) => el.geomId === 'datum_origin');
      const isOriginHovered =
        hoveredVertexRef.current && hoveredVertexRef.current.geomId === 'datum_origin';

      if (isOriginSelected) {
        ctx.fillStyle = 'var(--cad-color-brand-secondary)';
        ctx.beginPath();
        ctx.arc(0, 0, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();
      } else if (isOriginHovered) {
        ctx.fillStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
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
        selectedElements: currentSelected,
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

          // Compute selected element object
          const targetElement = hoveredVertexRef.current
            ? { geomId: hoveredVertexRef.current.geomId, vertexType: hoveredVertexRef.current.type }
            : { geomId: hoveredGeomIdRef.current! };

          // Checks equality
          const isEquals = (el1: typeof targetElement, el2: typeof targetElement) =>
            el1.geomId === el2.geomId && el1.vertexType === el2.vertexType;

          if (e.ctrlKey || e.shiftKey) {
            if (currentSelected.some((el) => isEquals(el, targetElement))) {
              setSelectedElements(currentSelected.filter((el) => !isEquals(el, targetElement)));
            } else {
              setSelectedElements([...currentSelected, targetElement]);
            }
          } else {
            if (!currentSelected.some((el) => isEquals(el, targetElement))) {
              setSelectedElements([targetElement]);
            }
          }
          e.preventDefault();
        } else {
          // click empty space -> clear selection
          if (!e.ctrlKey && !e.shiftKey) {
            setSelectedElements([]);
          }
        }
        return;
      }

      // Handle drawing triggers
      if (e.button === 0 && currentTool !== 'select') {
        const worldPos = screenToWorld(e.clientX, e.clientY);

        const sketchId = currentSketchId;
        if (!sketchId) {
          return;
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
            setActiveTool('select');
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
            setActiveTool('select');
          } else if (currentTool === 'arc') {
            const dx = worldPos.x - start.x;
            const dy = worldPos.y - start.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            const startAngle = Math.atan2(worldPos.y - start.y, worldPos.x - start.x);
            addSketchGeometry({
              type: 'arc',
              id,
              center: start,
              radius,
              startAngle,
              endAngle: startAngle + Math.PI,
            });
            isDrawingRef.current = false;
            drawingStartRef.current = null;
            previewRef.current = null;
            setActiveTool('select');
          } else if (currentTool === 'triangle') {
            const bx1 = start.x;
            const by1 = worldPos.y;
            const bx2 = worldPos.x;
            const by2 = worldPos.y;
            const px = (start.x + worldPos.x) / 2;
            const py = start.y;
            const t = Date.now();

            addSketchGeometry({
              type: 'line',
              id: `line_tri1_${t}`,
              start: { x: bx1, y: by1 },
              end: { x: bx2, y: by2 },
            });
            addSketchGeometry({
              type: 'line',
              id: `line_tri2_${t}`,
              start: { x: bx2, y: by2 },
              end: { x: px, y: py },
            });
            addSketchGeometry({
              type: 'line',
              id: `line_tri3_${t}`,
              start: { x: px, y: py },
              end: { x: bx1, y: by1 },
            });

            isDrawingRef.current = false;
            drawingStartRef.current = null;
            previewRef.current = null;
            setActiveTool('select');
          } else if (currentTool === 'slot') {
            const h = Math.abs(worldPos.y - start.y);
            const radius = h / 2;
            if (radius > 1) {
              const x1 = Math.min(start.x, worldPos.x);
              const x2 = Math.max(start.x, worldPos.x);
              const y1 = start.y;
              const y2 = worldPos.y;
              const cy = (y1 + y2) / 2;
              const t = Date.now();

              addSketchGeometry({
                type: 'line',
                id: `line_slot1_${t}`,
                start: { x: x1 + radius, y: y1 },
                end: { x: x2 - radius, y: y1 },
              });
              addSketchGeometry({
                type: 'line',
                id: `line_slot2_${t}`,
                start: { x: x1 + radius, y: y2 },
                end: { x: x2 - radius, y: y2 },
              });
              addSketchGeometry({
                type: 'arc',
                id: `arc_slot1_${t}`,
                center: { x: x1 + radius, y: cy },
                radius,
                startAngle: Math.PI / 2,
                endAngle: (Math.PI * 3) / 2,
              });
              addSketchGeometry({
                type: 'arc',
                id: `arc_slot2_${t}`,
                center: { x: x2 - radius, y: cy },
                radius,
                startAngle: -Math.PI / 2,
                endAngle: Math.PI / 2,
              });
            }

            isDrawingRef.current = false;
            drawingStartRef.current = null;
            previewRef.current = null;
            setActiveTool('select');
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
            } else if (geom.type === 'arc') {
              if (vType === 'center') {
                return {
                  ...geom,
                  center: { x: geom.center.x + dx, y: geom.center.y + dy },
                };
              }
              const currentX =
                vType === 'start'
                  ? geom.center.x + geom.radius * Math.cos(geom.startAngle)
                  : geom.center.x + geom.radius * Math.cos(geom.endAngle);
              const currentY =
                vType === 'start'
                  ? geom.center.y + geom.radius * Math.sin(geom.startAngle)
                  : geom.center.y + geom.radius * Math.sin(geom.endAngle);
              const newPt = {
                x: currentX + dx,
                y: currentY + dy,
              };
              const newRadius = distance(newPt, geom.center);
              const newAngle = Math.atan2(newPt.y - geom.center.y, newPt.x - geom.center.x);
              return {
                ...geom,
                radius: newRadius,
                startAngle: vType === 'start' ? newAngle : geom.startAngle,
                endAngle: vType === 'end' ? newAngle : geom.endAngle,
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
            } else if (geom.type === 'arc') {
              return {
                ...geom,
                center: { x: geom.center.x + dx, y: geom.center.y + dy },
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
        } else if (currentTool === 'arc') {
          const dx = worldPos.x - start.x;
          const dy = worldPos.y - start.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          const startAngle = Math.atan2(worldPos.y - start.y, worldPos.x - start.x);
          previewRef.current = {
            type: 'arc',
            id: previewId,
            center: start,
            radius,
            startAngle,
            endAngle: startAngle + Math.PI,
          };
        } else if (currentTool === 'triangle') {
          const bx1 = start.x;
          const by1 = worldPos.y;
          const bx2 = worldPos.x;
          const by2 = worldPos.y;
          const px = (start.x + worldPos.x) / 2;
          const py = start.y;
          previewRef.current = [
            {
              type: 'line',
              id: `${previewId}_1`,
              start: { x: bx1, y: by1 },
              end: { x: bx2, y: by2 },
            },
            {
              type: 'line',
              id: `${previewId}_2`,
              start: { x: bx2, y: by2 },
              end: { x: px, y: py },
            },
            {
              type: 'line',
              id: `${previewId}_3`,
              start: { x: px, y: py },
              end: { x: bx1, y: by1 },
            },
          ];
        } else if (currentTool === 'slot') {
          const h = Math.abs(worldPos.y - start.y);
          const radius = h / 2;
          const x1 = Math.min(start.x, worldPos.x);
          const x2 = Math.max(start.x, worldPos.x);
          const y1 = start.y;
          const y2 = worldPos.y;
          const cy = (y1 + y2) / 2;

          previewRef.current = [
            {
              type: 'line',
              id: `${previewId}_1`,
              start: { x: x1 + radius, y: y1 },
              end: { x: x2 - radius, y: y1 },
            },
            {
              type: 'line',
              id: `${previewId}_2`,
              start: { x: x1 + radius, y: y2 },
              end: { x: x2 - radius, y: y2 },
            },
            {
              type: 'arc',
              id: `${previewId}_3`,
              center: { x: x1 + radius, y: cy },
              radius,
              startAngle: Math.PI / 2,
              endAngle: (Math.PI * 3) / 2,
            },
            {
              type: 'arc',
              id: `${previewId}_4`,
              center: { x: x2 - radius, y: cy },
              radius,
              startAngle: -Math.PI / 2,
              endAngle: Math.PI / 2,
            },
          ];
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
            } else if (geom.type === 'arc') {
              if (distance(worldPos, geom.center) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'center', point: geom.center };
                break;
              }
              const startPt = {
                x: geom.center.x + geom.radius * Math.cos(geom.startAngle),
                y: geom.center.y + geom.radius * Math.sin(geom.startAngle),
              };
              if (distance(worldPos, startPt) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'start', point: startPt };
                break;
              }
              const endPt = {
                x: geom.center.x + geom.radius * Math.cos(geom.endAngle),
                y: geom.center.y + geom.radius * Math.sin(geom.endAngle),
              };
              if (distance(worldPos, endPt) <= toleranceInWorld) {
                hitVertex = { geomId: geom.id, type: 'end', point: endPt };
                break;
              }
            }
          }
        }

        if (!hitVertex && !hitGeomId) {
          for (const geom of localGeometriesRef.current) {
            // Check boundaries
            if (geom.type === 'line' && hitTestLine(worldPos, geom, toleranceInWorld)) {
              hitGeomId = geom.id;
            } else if (geom.type === 'circle' && hitTestCircle(worldPos, geom, toleranceInWorld)) {
              hitGeomId = geom.id;
            } else if (geom.type === 'rect' && hitTestRect(worldPos, geom, toleranceInWorld)) {
              hitGeomId = geom.id;
            } else if (geom.type === 'arc' && hitTestArc(worldPos, geom, toleranceInWorld)) {
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

    // Double click to edit dimension constraint value
    const handleDoubleClick = (e: MouseEvent) => {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const { zoom } = transformRef.current;

      // Find if we clicked near any dimension text
      const clickedDim = dimensionTextsRef.current.find((dim) => {
        const dist = distance(worldPos, { x: dim.x, y: dim.y });
        return dist <= 20 / zoom; // 20px hit radius
      });

      if (clickedDim) {
        const input = prompt('Edit dimension value (mm):', clickedDim.value.toString());
        if (input !== null) {
          const val = parseFloat(input);
          if (!isNaN(val)) {
            updateSketchConstraint(clickedDim.id, val);
          }
        }
        e.preventDefault();
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('dblclick', handleDoubleClick);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [
    addFeature,
    enterSketchEdit,
    addSketchGeometry,
    updateFeature,
    setSelectedElements,
    updateSketchConstraint,
    setActiveTool,
    settings.theme,
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
