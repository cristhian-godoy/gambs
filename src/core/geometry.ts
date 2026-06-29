/**
 * 2D Point structure representing Cartesian coordinates.
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 2D Vector structure.
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Axis-Aligned Bounding Box (AABB) for 2D geometry.
 */
export interface BoundingBox2D {
  min: Point2D;
  max: Point2D;
}

/**
 * 2D Line Segment represented by start and end points.
 */
export interface Line2D {
  id: string;
  start: Point2D;
  end: Point2D;
}

/**
 * 2D Rectangle represented by diagonal corner points start and end.
 */
export interface Rect2D {
  id: string;
  start: Point2D;
  end: Point2D;
}

/**
 * 2D Circle represented by a center point and radius.
 */
export interface Circle2D {
  id: string;
  center: Point2D;
  radius: number;
}

/**
 * 2D Arc represented by center, radius, and angular limits.
 */
export interface Arc2D {
  id: string;
  center: Point2D;
  radius: number;
  startAngle: number; // in radians
  endAngle: number; // in radians
}

/**
 * Calculates the Euclidean distance between two points.
 * @param p1 First point.
 * @param p2 Second point.
 * @returns The distance.
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Subtracts two points to form a vector.
 * @param p1 Target point.
 * @param p2 Source point.
 * @returns The vector p1 - p2.
 */
export function subtract(p1: Point2D, p2: Point2D): Vector2D {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
}

/**
 * Adds a vector to a point.
 * @param p Base point.
 * @param v Vector to add.
 * @returns The resulting point.
 */
export function add(p: Point2D, v: Vector2D): Point2D {
  return { x: p.x + v.x, y: p.y + v.y };
}

/**
 * Calculates dot product of two vectors.
 * @param v1 First vector.
 * @param v2 Second vector.
 * @returns The dot product value.
 */
export function dot(v1: Vector2D, v2: Vector2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Calculates length of a vector.
 * @param v The vector.
 * @returns The length.
 */
export function length(v: Vector2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Normalizes a vector.
 * @param v The vector.
 * @returns The normalized vector.
 */
export function normalize(v: Vector2D): Vector2D {
  const len = length(v);
  if (len < 1e-8) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

/**
 * Projects a point onto a line segment.
 * @param p The point to project.
 * @param line The line segment.
 * @returns The projected point clamped onto the line segment.
 */
export function projectPointOnLine(p: Point2D, line: Line2D): Point2D {
  const ab = subtract(line.end, line.start);
  const ap = subtract(p, line.start);
  const abLen2 = dot(ab, ab);

  if (abLen2 < 1e-8) {
    return line.start;
  }

  let t = dot(ap, ab) / abLen2;
  t = Math.max(0, Math.min(1, t)); // clamp to line segment limits

  return {
    x: line.start.x + t * ab.x,
    y: line.start.y + t * ab.y,
  };
}

/**
 * Calculates distance from point to a line segment.
 * @param p The point.
 * @param line The line segment.
 * @returns The distance.
 */
export function distancePointToLineSegment(p: Point2D, line: Line2D): number {
  const proj = projectPointOnLine(p, line);
  return distance(p, proj);
}

/**
 * Computes the Axis-Aligned Bounding Box (AABB) of a line segment.
 * @param line The line segment.
 * @returns The bounding box.
 */
export function getLineAABB(line: Line2D): BoundingBox2D {
  return {
    min: {
      x: Math.min(line.start.x, line.end.x),
      y: Math.min(line.start.y, line.end.y),
    },
    max: {
      x: Math.max(line.start.x, line.end.x),
      y: Math.max(line.start.y, line.end.y),
    },
  };
}

/**
 * Computes the Axis-Aligned Bounding Box (AABB) of a circle.
 * @param circle The circle.
 * @returns The bounding box.
 */
export function getCircleAABB(circle: Circle2D): BoundingBox2D {
  return {
    min: {
      x: circle.center.x - circle.radius,
      y: circle.center.y - circle.radius,
    },
    max: {
      x: circle.center.x + circle.radius,
      y: circle.center.y + circle.radius,
    },
  };
}

/**
 * Computes the Axis-Aligned Bounding Box (AABB) of a rectangle.
 * @param rect The rectangle.
 * @returns The bounding box.
 */
export function getRectAABB(rect: Rect2D): BoundingBox2D {
  return {
    min: {
      x: Math.min(rect.start.x, rect.end.x),
      y: Math.min(rect.start.y, rect.end.y),
    },
    max: {
      x: Math.max(rect.start.x, rect.end.x),
      y: Math.max(rect.start.y, rect.end.y),
    },
  };
}

/**
 * Computes the Axis-Aligned Bounding Box (AABB) of a circular arc.
 * @param arc The circular arc.
 * @returns The bounding box.
 */
export function getArcAABB(arc: Arc2D): BoundingBox2D {
  const startX = arc.center.x + arc.radius * Math.cos(arc.startAngle);
  const startY = arc.center.y + arc.radius * Math.sin(arc.startAngle);
  const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
  const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);

  let minX = Math.min(startX, endX);
  let minY = Math.min(startY, endY);
  let maxX = Math.max(startX, endX);
  let maxY = Math.max(startY, endY);

  // Helper to check if a specific angle lies within the arc's angular range
  const angleInRange = (angle: number) => {
    let s = arc.startAngle;
    let e = arc.endAngle;
    // Normalize angles to 0..2PI range for simple comparison
    const normalizeAngle = (a: number) => {
      const twoPi = Math.PI * 2;
      return ((a % twoPi) + twoPi) % twoPi;
    };

    s = normalizeAngle(s);
    e = normalizeAngle(e);
    const a = normalizeAngle(angle);

    if (s <= e) {
      return a >= s && a <= e;
    } else {
      return a >= s || a <= e;
    }
  };

  // Check critical points (0, PI/2, PI, 3PI/2)
  const criticalAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  for (const angle of criticalAngles) {
    if (angleInRange(angle)) {
      const cx = arc.center.x + arc.radius * Math.cos(angle);
      const cy = arc.center.y + arc.radius * Math.sin(angle);
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx);
      maxY = Math.max(maxY, cy);
    }
  }

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
  };
}

/**
 * Draws a line segment on canvas.
 * @param ctx The Canvas rendering context.
 * @param line The line segment.
 */
export function drawLine(ctx: CanvasRenderingContext2D, line: Line2D): void {
  ctx.beginPath();
  ctx.moveTo(line.start.x, line.start.y);
  ctx.lineTo(line.end.x, line.end.y);
  ctx.stroke();
}

/**
 * Draws a circle on canvas.
 * @param ctx The Canvas rendering context.
 * @param circle The circle.
 */
export function drawCircle(ctx: CanvasRenderingContext2D, circle: Circle2D): void {
  ctx.beginPath();
  ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draws a circular arc on canvas.
 * @param ctx The Canvas rendering context.
 * @param arc The arc.
 */
export function drawArc(ctx: CanvasRenderingContext2D, arc: Arc2D): void {
  ctx.beginPath();
  // Canvas context arc handles CCW by default if counterclockwise is false (which it is)
  // But since we inverted the Y-axis on canvas (scale(zoom, -zoom)), standard positive angles go CCW.
  ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, false);
  ctx.stroke();
}

/**
 * Draws a rectangle on canvas.
 * @param ctx The Canvas rendering context.
 * @param rect The rectangle.
 */
export function drawRect(ctx: CanvasRenderingContext2D, rect: Rect2D): void {
  ctx.beginPath();
  // We need to draw drawing standard rectangles.
  // In our inverted Y system, y direction is inverted.
  const width = rect.end.x - rect.start.x;
  const height = rect.end.y - rect.start.y;
  ctx.rect(rect.start.x, rect.start.y, width, height);
  ctx.stroke();
}
