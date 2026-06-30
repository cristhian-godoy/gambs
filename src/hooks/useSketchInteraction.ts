import { type RefObject, useEffect, useRef } from 'react';

import { distance, hitTestArc, hitTestCircle, hitTestLine, hitTestRect } from '../core/geometry.ts';
import { type SketchConstraint, solveSketch } from '../core/solver.ts';
import type { SelectedElement, ToolType } from '../store/CadContext.tsx';
import type { AppSettings } from '../store/settingsStore.ts';
import type { Feature, SketchGeometry } from '../store/types.ts';
import {
  type DimensionTextInfo,
  resolvePointCoords,
  type Vertex,
} from '../utils/sketchRenderer.ts';

interface UseSketchInteractionProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  transformRef: RefObject<{ zoom: number; offsetX: number; offsetY: number }>;
  requestRedraw: () => void;
  localGeometriesRef: RefObject<SketchGeometry[]>;
  dimensionTextsRef: RefObject<DimensionTextInfo[]>;
  setCoords: (coords: { x: number; y: number }) => void;
  settings: AppSettings;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeSketchId: string | null;
  features: Feature[];
  selectedElements: SelectedElement[];
  setSelectedElements: (elements: SelectedElement[]) => void;
  addSketchGeometry: (geometry: SketchGeometry) => void;
  updateSketchConstraint: (constraintId: string, value: number) => void;
  updateFeature: (id: string, params: Record<string, unknown>) => void;
  previewRef: RefObject<SketchGeometry | SketchGeometry[] | null>;
  hoveredGeomIdRef: RefObject<string | null>;
  hoveredVertexRef: RefObject<Vertex | null>;
}

const getSnapTarget = (
  worldPos: { x: number; y: number },
  geometries: SketchGeometry[],
  zoom: number,
): { x: number; y: number } => {
  const tolerance = 10 / zoom; // 10px snapping threshold
  let closestVertex: { x: number; y: number } | null = null;
  let minDistance = tolerance;

  for (const geom of geometries) {
    const vertices: { x: number; y: number }[] = [];
    if (geom.type === 'line') {
      vertices.push(geom.start, geom.end);
    } else if (geom.type === 'circle') {
      vertices.push(geom.center);
    } else if (geom.type === 'rect') {
      vertices.push(
        geom.start,
        geom.end,
        { x: geom.end.x, y: geom.start.y },
        {
          x: geom.start.x,
          y: geom.end.y,
        },
      );
    } else if (geom.type === 'arc') {
      vertices.push(
        geom.center,
        {
          x: geom.center.x + geom.radius * Math.cos(geom.startAngle),
          y: geom.center.y + geom.radius * Math.sin(geom.startAngle),
        },
        {
          x: geom.center.x + geom.radius * Math.cos(geom.endAngle),
          y: geom.center.y + geom.radius * Math.sin(geom.endAngle),
        },
      );
    }

    for (const v of vertices) {
      const d = distance(worldPos, v);
      if (d < minDistance) {
        minDistance = d;
        closestVertex = v;
      }
    }
  }

  // Check global origin
  const dOrigin = distance(worldPos, { x: 0, y: 0 });
  if (dOrigin < minDistance) {
    closestVertex = { x: 0, y: 0 };
  }

  return closestVertex || worldPos;
};

function getTemporaryFixedConstraints(
  draggedVertex: Vertex | null,
  draggedGeomId: string | null,
  draggedGeoms: SketchGeometry[],
): SketchConstraint[] {
  const temp: SketchConstraint[] = [];
  if (draggedVertex) {
    const geom = draggedGeoms.find((g) => g.id === draggedVertex.geomId);
    if (geom) {
      const pt = resolvePointCoords(
        { geomId: geom.id, vertexType: draggedVertex.type },
        draggedGeoms,
      );
      temp.push({
        id: 'temp_drag_fixed',
        type: 'fixed',
        targets: [{ geomId: draggedVertex.geomId, vertexType: draggedVertex.type }],
        xValue: pt.x,
        yValue: pt.y,
      });
    }
  } else if (draggedGeomId) {
    const geom = draggedGeoms.find((g) => g.id === draggedGeomId);
    if (geom) {
      if (geom.type === 'line') {
        temp.push(
          {
            id: 'temp_drag_fixed_start',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'start' }],
            xValue: geom.start.x,
            yValue: geom.start.y,
          },
          {
            id: 'temp_drag_fixed_end',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'end' }],
            xValue: geom.end.x,
            yValue: geom.end.y,
          },
        );
      } else if (geom.type === 'circle') {
        temp.push({
          id: 'temp_drag_fixed_center',
          type: 'fixed',
          targets: [{ geomId: draggedGeomId, vertexType: 'center' }],
          xValue: geom.center.x,
          yValue: geom.center.y,
        });
      } else if (geom.type === 'rect') {
        temp.push(
          {
            id: 'temp_drag_fixed_start',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'start' }],
            xValue: geom.start.x,
            yValue: geom.start.y,
          },
          {
            id: 'temp_drag_fixed_end',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'end' }],
            xValue: geom.end.x,
            yValue: geom.end.y,
          },
        );
      } else if (geom.type === 'arc') {
        const startPt = {
          x: geom.center.x + geom.radius * Math.cos(geom.startAngle),
          y: geom.center.y + geom.radius * Math.sin(geom.startAngle),
        };
        const endPt = {
          x: geom.center.x + geom.radius * Math.cos(geom.endAngle),
          y: geom.center.y + geom.radius * Math.sin(geom.endAngle),
        };
        temp.push(
          {
            id: 'temp_drag_fixed_center',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'center' }],
            xValue: geom.center.x,
            yValue: geom.center.y,
          },
          {
            id: 'temp_drag_fixed_start',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'start' }],
            xValue: startPt.x,
            yValue: startPt.y,
          },
          {
            id: 'temp_drag_fixed_end',
            type: 'fixed',
            targets: [{ geomId: draggedGeomId, vertexType: 'end' }],
            xValue: endPt.x,
            yValue: endPt.y,
          },
        );
      }
    }
  }
  return temp;
}

/**
 * Hook to manage drawing, panning, zooming, dragging, and hover mouse interactions on Sketch Canvas.
 */
export function useSketchInteraction({
  canvasRef,
  screenToWorld,
  transformRef,
  requestRedraw,
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
}: UseSketchInteractionProps) {
  const isPanningRef = useRef(false);
  const startDragRef = useRef({ x: 0, y: 0 });

  // Drawing state
  const isDrawingRef = useRef(false);
  const drawingStartRef = useRef<{ x: number; y: number } | null>(null);

  // Drag modification state
  const isDraggingEntityRef = useRef(false);
  const dragStartWorldRef = useRef<{ x: number; y: number } | null>(null);
  const draggedVertexRef = useRef<Vertex | null>(null);
  const draggedGeomIdRef = useRef<string | null>(null);
  const initialGeomsForDragRef = useRef<SketchGeometry[]>([]);

  // Animation frame throttling
  const rafIdRef = useRef<number | null>(null);
  const pendingMouseMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Keep state refs updated to avoid closures issue
  const stateRef = useRef({
    activeTool,
    activeSketchId,
    features,
    selectedElements,
  });

  useEffect(() => {
    stateRef.current = { activeTool, activeSketchId, features, selectedElements };
  }, [activeTool, activeSketchId, features, selectedElements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const processPendingInteraction = () => {
      rafIdRef.current = null;
      if (!pendingMouseMoveRef.current) return;
      const { clientX, clientY } = pendingMouseMoveRef.current;
      pendingMouseMoveRef.current = null;

      const { activeTool: currentTool, activeSketchId: currentSketchId } = stateRef.current;
      let worldPos = screenToWorld(clientX, clientY);
      if (currentTool !== 'select' && settings.snapToVertices) {
        const { zoom } = transformRef.current;
        worldPos = getSnapTarget(worldPos, localGeometriesRef.current || [], zoom);
      }

      // Handle Drag Modification
      if (isDraggingEntityRef.current && currentSketchId) {
        const start = dragStartWorldRef.current!;
        const dx = worldPos.x - start.x;
        const dy = worldPos.y - start.y;

        const draggedGeoms = initialGeomsForDragRef.current.map((geom) => {
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

        // Resolve constraints during dragging
        const activeSketch = stateRef.current.features.find((f) => f.id === currentSketchId);
        const constraints = (activeSketch?.params.constraints as SketchConstraint[]) || [];
        const tempConstraints = getTemporaryFixedConstraints(
          draggedVertexRef.current,
          draggedGeomIdRef.current,
          draggedGeoms,
        );

        const solved = solveSketch(draggedGeoms, [...constraints, ...tempConstraints]);

        if (localGeometriesRef.current) {
          // Mutate local ref directly to maintain 60FPS
          (localGeometriesRef as { current: SketchGeometry[] }).current = solved.geometries;
        }
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
      }
    };

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

        if (hoveredVertexRef.current || hoveredGeomIdRef.current) {
          const isDatum =
            hoveredGeomIdRef.current?.startsWith('datum_') ||
            hoveredVertexRef.current?.geomId.startsWith('datum_');

          if (!isDatum) {
            isDraggingEntityRef.current = true;
            dragStartWorldRef.current = worldPos;
            initialGeomsForDragRef.current = JSON.parse(
              JSON.stringify(localGeometriesRef.current || []),
            );

            if (hoveredVertexRef.current) {
              draggedVertexRef.current = { ...hoveredVertexRef.current };
              draggedGeomIdRef.current = null;
            } else {
              draggedGeomIdRef.current = hoveredGeomIdRef.current;
              draggedVertexRef.current = null;
            }
          }

          const targetElement = hoveredVertexRef.current
            ? { geomId: hoveredVertexRef.current.geomId, vertexType: hoveredVertexRef.current.type }
            : { geomId: hoveredGeomIdRef.current! };

          const isEquals = (el1: typeof targetElement, el2: typeof targetElement) =>
            el1.geomId === el2.geomId && el1.vertexType === el2.vertexType;

          if (settings.multiSelectMethod === 'click' || e.ctrlKey || e.metaKey || e.shiftKey) {
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
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            setSelectedElements([]);
          }
        }
        return;
      }

      // Handle drawing triggers
      if (e.button === 0 && currentTool !== 'select') {
        let worldPos = screenToWorld(e.clientX, e.clientY);
        if (settings.snapToVertices) {
          const { zoom } = transformRef.current;
          worldPos = getSnapTarget(worldPos, localGeometriesRef.current || [], zoom);
        }

        const sketchId = currentSketchId;
        if (!sketchId) return;

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
      let worldPos = screenToWorld(e.clientX, e.clientY);
      if (currentTool !== 'select' && settings.snapToVertices) {
        const { zoom } = transformRef.current;
        worldPos = getSnapTarget(worldPos, localGeometriesRef.current || [], zoom);
      }
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

      if (isDraggingEntityRef.current || isDrawingRef.current) {
        pendingMouseMoveRef.current = { clientX: e.clientX, clientY: e.clientY };
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(processPendingInteraction);
        }
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
          for (const geom of localGeometriesRef.current || []) {
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
          for (const geom of localGeometriesRef.current || []) {
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

        if (currentSketchId && localGeometriesRef.current) {
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

    const handleDoubleClick = (e: MouseEvent) => {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const { zoom } = transformRef.current;

      const clickedDim = (dimensionTextsRef.current || []).find((dim) => {
        const dist = distance(worldPos, { x: dim.x, y: dim.y });
        return dist <= 20 / zoom;
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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [
    canvasRef,
    addSketchGeometry,
    updateSketchConstraint,
    updateFeature,
    setSelectedElements,
    setActiveTool,
    screenToWorld,
    transformRef,
    requestRedraw,
    localGeometriesRef,
    dimensionTextsRef,
    setCoords,
    settings.theme,
    settings.multiSelectMethod,
    settings.snapToVertices,
    hoveredGeomIdRef,
    hoveredVertexRef,
    previewRef,
  ]);

  return {
    isPanningRef,
  };
}
