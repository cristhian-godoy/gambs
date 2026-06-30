import { drawArc, drawCircle, drawLine, drawRect } from '../core/geometry.ts';
import type { SketchConstraint } from '../core/solver.ts';
import type { SelectedElement } from '../store/CadContext.tsx';
import type { AppSettings } from '../store/settingsStore.ts';
import type { SketchGeometry } from '../store/types.ts';

/**
 * Representation of a sketch vertex element.
 */
export interface Vertex {
  geomId: string;
  type: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  point: { x: number; y: number };
}

/**
 * Information describing constraint dimension text location and values.
 */
export interface DimensionTextInfo {
  id: string;
  x: number;
  y: number;
  value: number;
}

/**
 * Resolves the absolute 2D coordinates for a constraint target.
 * @param target Constraint target specifying entity and optional vertex type.
 * @param geomsList List of available sketch geometries.
 * @returns 2D point coordinates.
 */
export function resolvePointCoords(
  target: {
    geomId: string;
    vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  },
  geomsList: SketchGeometry[],
): { x: number; y: number } {
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
}

/**
 * Renders the coordinate grid and datum axes on the canvas.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: { zoom: number; offsetX: number; offsetY: number },
  settings: AppSettings,
  selectedElements: SelectedElement[],
  hoveredGeomId: string | null,
  brandSecondaryColor: string,
) {
  const { zoom, offsetX, offsetY } = transform;

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
  const isXSelected = selectedElements.some((el) => el.geomId === 'datum_axis_x');
  const isXHovered = hoveredGeomId === 'datum_axis_x';
  if (isXSelected) {
    ctx.strokeStyle = brandSecondaryColor;
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
  const isYSelected = selectedElements.some((el) => el.geomId === 'datum_axis_y');
  const isYHovered = hoveredGeomId === 'datum_axis_y';
  if (isYSelected) {
    ctx.strokeStyle = brandSecondaryColor;
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

  ctx.restore();
}

/**
 * Draws the active sketch geometries on the canvas.
 */
export function drawGeometries(
  ctx: CanvasRenderingContext2D,
  geometries: SketchGeometry[],
  selectedElements: SelectedElement[],
  hoveredGeomId: string | null,
  hoveredVertex: Vertex | null,
  transform: { zoom: number; offsetX: number; offsetY: number },
  settings: AppSettings,
  converged: boolean,
  dof: number,
  brandMainColor: string,
  brandSecondaryColor: string,
) {
  const { zoom, offsetX, offsetY } = transform;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, -zoom);

  for (const geom of geometries) {
    const isSelected = selectedElements.some(
      (el) => el.geomId === geom.id && el.vertexType === undefined,
    );
    const isHovered = hoveredGeomId === geom.id;

    // Set drawing styles based on construction line type
    if (geom.isConstruction) {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.lineWidth = 1.5 / zoom;
      if (isSelected) {
        ctx.strokeStyle = brandSecondaryColor;
      } else if (isHovered) {
        ctx.strokeStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
      } else {
        ctx.strokeStyle =
          settings.theme === 'light' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.25)';
      }
    } else {
      ctx.setLineDash([]);
      if (isSelected) {
        ctx.strokeStyle = brandSecondaryColor;
        ctx.lineWidth = 3 / zoom;
      } else if (isHovered) {
        ctx.strokeStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
        ctx.lineWidth = 2.5 / zoom;
      } else if (!converged) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / zoom;
      } else if (dof === 0) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2 / zoom;
      } else {
        ctx.strokeStyle = brandMainColor;
        ctx.lineWidth = 2 / zoom;
      }
    }

    if (geom.type === 'line') drawLine(ctx, geom);
    else if (geom.type === 'circle') drawCircle(ctx, geom);
    else if (geom.type === 'rect') drawRect(ctx, geom);
    else if (geom.type === 'arc') drawArc(ctx, geom);

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
        hoveredVertex && hoveredVertex.geomId === vert.geomId && hoveredVertex.type === vert.type;

      const isVertSelected = selectedElements.some(
        (el) => el.geomId === vert.geomId && el.vertexType === vert.type,
      );

      if (isVertHovered) {
        ctx.fillStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
        ctx.beginPath();
        ctx.arc(vert.point.x, vert.point.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isVertSelected
          ? brandSecondaryColor
          : geom.isConstruction
            ? settings.theme === 'light'
              ? 'rgba(0, 0, 0, 0.4)'
              : 'rgba(255, 255, 255, 0.4)'
            : brandMainColor;
        ctx.beginPath();
        ctx.arc(vert.point.x, vert.point.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Draws current active drawing tool preview guides.
 */
export function drawPreview(
  ctx: CanvasRenderingContext2D,
  preview: SketchGeometry | SketchGeometry[] | null,
  transform: { zoom: number; offsetX: number; offsetY: number },
  settings: AppSettings,
) {
  if (!preview) return;
  const { zoom, offsetX, offsetY } = transform;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, -zoom);

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

  if (Array.isArray(preview)) {
    preview.forEach(drawSinglePreview);
  } else {
    drawSinglePreview(preview);
  }

  ctx.restore();
}

/**
 * Helper to draw clean text right-side-up on transformed canvas.
 */
export function drawTextBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  zoom: number,
  theme: 'dark' | 'light',
  color = theme === 'light' ? '#0f172a' : '#e2e8f0',
  size = 10,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / zoom, -1 / zoom); // counteract inverted Y scaling

  ctx.fillStyle = theme === 'light' ? 'rgba(241, 245, 249, 0.9)' : 'rgba(20, 20, 20, 0.85)';
  ctx.strokeStyle = theme === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
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
}

/**
 * Draws visual constraint badges and dimensions.
 */
export function drawConstraints(
  ctx: CanvasRenderingContext2D,
  constraints: SketchConstraint[],
  geometries: SketchGeometry[],
  transform: { zoom: number; offsetX: number; offsetY: number },
  settings: AppSettings,
  dimensionTextsList: DimensionTextInfo[],
) {
  const { zoom, offsetX, offsetY } = transform;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, -zoom);

  for (const c of constraints) {
    if (c.type === 'horizontal') {
      const line = geometries.find((g) => g.id === c.targets[0].geomId);
      if (line && line.type === 'line') {
        const mx = (line.start.x + line.end.x) / 2;
        const my = (line.start.y + line.end.y) / 2;
        drawTextBadge(
          ctx,
          'H',
          mx,
          my + 15 / zoom,
          zoom,
          settings.theme,
          settings.theme === 'light' ? '#1d4ed8' : '#60a5fa',
        );
      }
    } else if (c.type === 'vertical') {
      const line = geometries.find((g) => g.id === c.targets[0].geomId);
      if (line && line.type === 'line') {
        const mx = (line.start.x + line.end.x) / 2;
        const my = (line.start.y + line.end.y) / 2;
        drawTextBadge(
          ctx,
          'V',
          mx + 15 / zoom,
          my,
          zoom,
          settings.theme,
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
        const offsetDist = 20 / zoom;

        const ox = mx + nx * offsetDist;
        const oy = my + ny * offsetDist;

        ctx.strokeStyle = settings.theme === 'light' ? '#b45309' : '#f59e0b';
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

        const val = c.value !== undefined ? c.value : len;
        drawTextBadge(
          ctx,
          `${val.toFixed(1)} mm`,
          ox,
          oy,
          zoom,
          settings.theme,
          settings.theme === 'light' ? '#b45309' : '#f59e0b',
          10,
        );

        dimensionTextsList.push({ id: c.id, x: ox, y: oy, value: val });
      }
    } else if (c.type === 'radius') {
      const circle = geometries.find((g) => g.id === c.targets[0].geomId);
      if (circle && circle.type === 'circle') {
        const theta = Math.PI / 4;
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
          ctx,
          `R ${val.toFixed(1)}`,
          ox,
          oy,
          zoom,
          settings.theme,
          settings.theme === 'light' ? '#b45309' : '#f59e0b',
          10,
        );

        dimensionTextsList.push({ id: c.id, x: ox, y: oy, value: val });
      }
    } else if (c.type === 'angle') {
      const g1 = geometries.find((g) => g.id === c.targets[0].geomId);
      const g2 = geometries.find((g) => g.id === c.targets[1].geomId);
      if (g1 && g2 && g1.type === 'line' && g2.type === 'line') {
        const mx1 = (g1.start.x + g1.end.x) / 2;
        const my1 = (g1.start.y + g1.end.y) / 2;
        const mx2 = (g2.start.x + g2.end.x) / 2;
        const my2 = (g2.start.y + g2.end.y) / 2;

        const ax = (mx1 + mx2) / 2;
        const ay = (my1 + my2) / 2;

        const valRad = c.value !== undefined ? c.value : Math.PI / 2;
        const valDeg = (valRad * 180) / Math.PI;

        drawTextBadge(
          ctx,
          `${valDeg.toFixed(1)}°`,
          ax,
          ay,
          zoom,
          settings.theme,
          settings.theme === 'light' ? '#b45309' : '#f59e0b',
          10,
        );

        dimensionTextsList.push({ id: c.id, x: ax, y: ay, value: valDeg });
      }
    }
  }

  ctx.restore();
}

/**
 * Draws the origin point datum.
 */
export function drawOrigin(
  ctx: CanvasRenderingContext2D,
  selectedElements: SelectedElement[],
  hoveredVertex: Vertex | null,
  transform: { zoom: number; offsetX: number; offsetY: number },
  settings: AppSettings,
  brandMainColor: string,
  brandSecondaryColor: string,
) {
  const { zoom, offsetX, offsetY } = transform;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, -zoom);

  const isOriginSelected = selectedElements.some((el) => el.geomId === 'datum_origin');
  const isOriginHovered = hoveredVertex && hoveredVertex.geomId === 'datum_origin';

  if (isOriginSelected) {
    ctx.fillStyle = brandSecondaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, 6 / zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (isOriginHovered) {
    ctx.fillStyle = settings.theme === 'light' ? 'hsl(35deg 90% 45%)' : 'hsl(45deg 100% 50%)';
    ctx.beginPath();
    ctx.arc(0, 0, 6 / zoom, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = brandMainColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
