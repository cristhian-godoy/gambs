import { describe, expect, it } from 'vitest';

import { solveSketch } from './solver.ts';

describe('Sketch Solver', () => {
  it('solves simple horizontal and vertical constraints', () => {
    // Line 1: starting near horizontal
    const line = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0.5 },
    };

    const constraints = [
      {
        id: 'c1',
        type: 'horizontal' as const,
        targets: [{ geomId: 'l1' }],
      },
    ];

    const solved = solveSketch([line], constraints);
    expect(solved[0].type).toBe('line');
    // For minimum-norm update, start Y and end Y should converge to their average Y (0.25)
    expect(solved[0].start.y).toBeCloseTo(0.25);
    expect(solved[0].end.y).toBeCloseTo(0.25);
  });

  it('solves coincident constraints between line endpoints', () => {
    // Line 1: (0, 0) -> (10, 0)
    // Line 2: (10.5, 0.5) -> (20, 0)
    const line1 = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    const line2 = {
      type: 'line' as const,
      id: 'l2',
      start: { x: 10.5, y: 0.5 },
      end: { x: 20, y: 0 },
    };

    const constraints = [
      {
        id: 'c1',
        type: 'coincident' as const,
        targets: [
          { geomId: 'l1', vertexType: 'end' as const },
          { geomId: 'l2', vertexType: 'start' as const },
        ],
      },
    ];

    const solved = solveSketch([line1, line2], constraints);
    // End of line 1 and start of line 2 must meet at the same point!
    expect(solved[0].end.x).toBeCloseTo(solved[1].start.x);
    expect(solved[0].end.y).toBeCloseTo(solved[1].start.y);
  });

  it('solves perpendicular line constraints', () => {
    // Line 1: (0,0) -> (10, 0) - horizontal
    // Line 2: (5,0) -> (6, 10) - almost vertical
    const line1 = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    const line2 = {
      type: 'line' as const,
      id: 'l2',
      start: { x: 5, y: 0 },
      end: { x: 6, y: 10 },
    };

    const constraints = [
      // Pin line 1 horizontal
      {
        id: 'c1',
        type: 'horizontal' as const,
        targets: [{ geomId: 'l1' }],
      },
      // Pin perpendicular
      {
        id: 'c2',
        type: 'perpendicular' as const,
        targets: [{ geomId: 'l1' }, { geomId: 'l2' }],
      },
    ];

    const solved = solveSketch([line1, line2], constraints);
    const dx1 = solved[0].end.x - solved[0].start.x;
    const dy1 = solved[0].end.y - solved[0].start.y;
    const dx2 = solved[1].end.x - solved[1].start.x;
    const dy2 = solved[1].end.y - solved[1].start.y;

    // Dot product should be 0
    const dotProduct = dx1 * dx2 + dy1 * dy2;
    expect(dotProduct).toBeCloseTo(0, 5);
  });
});
