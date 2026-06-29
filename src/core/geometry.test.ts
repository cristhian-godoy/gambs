import { describe, expect, it } from 'vitest';

import {
  distance,
  distancePointToLineSegment,
  getArcAABB,
  getCircleAABB,
  getLineAABB,
  hitTestCircle,
  hitTestLine,
  hitTestRect,
  projectPointOnLine,
} from './geometry.ts';

describe('Geometry Utilities', () => {
  it('calculates distance correctly', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('projects points onto line segment', () => {
    const line = { id: 'l1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    const p1 = { x: 5, y: 5 };
    const p2 = { x: -2, y: 3 };
    const p3 = { x: 12, y: -4 };

    expect(projectPointOnLine(p1, line)).toEqual({ x: 5, y: 0 });
    expect(projectPointOnLine(p2, line)).toEqual({ x: 0, y: 0 }); // clamped
    expect(projectPointOnLine(p3, line)).toEqual({ x: 10, y: 0 }); // clamped
  });

  it('calculates distance to line segment', () => {
    const line = { id: 'l1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    const p1 = { x: 5, y: 5 };
    const p2 = { x: -2, y: 0 };

    expect(distancePointToLineSegment(p1, line)).toBe(5);
    expect(distancePointToLineSegment(p2, line)).toBe(2);
  });

  it('computes line AABB', () => {
    const line = { id: 'l1', start: { x: 2, y: 5 }, end: { x: -1, y: 8 } };
    const aabb = getLineAABB(line);
    expect(aabb.min).toEqual({ x: -1, y: 5 });
    expect(aabb.max).toEqual({ x: 2, y: 8 });
  });

  it('computes circle AABB', () => {
    const circle = { id: 'c1', center: { x: 5, y: 5 }, radius: 3 };
    const aabb = getCircleAABB(circle);
    expect(aabb.min).toEqual({ x: 2, y: 2 });
    expect(aabb.max).toEqual({ x: 8, y: 8 });
  });

  it('computes arc AABB', () => {
    // Semi circle arc from 0 to PI
    const arc = {
      id: 'a1',
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: Math.PI,
    };
    const aabb = getArcAABB(arc);
    // Start angle 0 -> (5, 0)
    // End angle PI -> (-5, 0)
    // Critical angle PI/2 -> (0, 5)
    expect(aabb.min.x).toBeCloseTo(-5);
    expect(aabb.min.y).toBeCloseTo(0);
    expect(aabb.max.x).toBeCloseTo(5);
    expect(aabb.max.y).toBeCloseTo(5);
  });

  it('performs hit testing correctly', () => {
    const line = { id: 'l1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    expect(hitTestLine({ x: 5, y: 0.1 }, line, 0.2)).toBe(true);
    expect(hitTestLine({ x: 5, y: 0.5 }, line, 0.2)).toBe(false);

    const circle = { id: 'c1', center: { x: 0, y: 0 }, radius: 5 };
    expect(hitTestCircle({ x: 5.1, y: 0 }, circle, 0.2)).toBe(true);
    expect(hitTestCircle({ x: 3, y: 3 }, circle, 0.2)).toBe(false);

    const rect = { id: 'r1', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
    expect(hitTestRect({ x: 5, y: 0.05 }, rect, 0.1)).toBe(true); // on top edge
    expect(hitTestRect({ x: 5, y: 5 }, rect, 0.1)).toBe(false); // inside but not on edge
  });
});
