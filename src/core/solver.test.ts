/* eslint-disable @typescript-eslint/no-explicit-any */
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

    const solved = solveSketch([line], constraints).geometries as any[];
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

    const solved = solveSketch([line1, line2], constraints).geometries as any[];
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

    const solved = solveSketch([line1, line2], constraints).geometries as any[];
    const dx1 = solved[0].end.x - solved[0].start.x;
    const dy1 = solved[0].end.y - solved[0].start.y;
    const dx2 = solved[1].end.x - solved[1].start.x;
    const dy2 = solved[1].end.y - solved[1].start.y;

    // Dot product should be 0
    const dotProduct = dx1 * dx2 + dy1 * dy2;
    expect(dotProduct).toBeCloseTo(0, 5);
  });

  it('solves point-on-line constraints', () => {
    // Line: (0,0) -> (10, 10)
    // Point: Circle center at (5, 6)
    const line = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    };
    const circle = {
      type: 'circle' as const,
      id: 'c1',
      center: { x: 5, y: 6 },
      radius: 2,
    };

    const constraints = [
      {
        id: 'c1',
        type: 'point_on_line' as const,
        targets: [{ geomId: 'c1', vertexType: 'center' as const }, { geomId: 'l1' }],
      },
      // Fix line start at (0,0)
      {
        id: 'c2',
        type: 'fixed' as const,
        targets: [{ geomId: 'l1', vertexType: 'start' as const }],
        value: 0,
      },
      // Fix line end at (10,10)
      {
        id: 'c3',
        type: 'fixed' as const,
        targets: [{ geomId: 'l1', vertexType: 'end' as const }],
        value: 10,
      },
    ];

    const solved = solveSketch([line, circle], constraints).geometries as any[];
    // Center must end up on the diagonal y = x (approx 5.5, 5.5)
    expect(solved[1].center.x).toBeCloseTo(5.5);
    expect(solved[1].center.y).toBeCloseTo(5.5);
  });

  it('solves tangent constraints between line and circle', () => {
    // Circle at (0,0) with radius 5
    // Line from (5.5, -10) to (5.5, 10)
    const circle = {
      type: 'circle' as const,
      id: 'c1',
      center: { x: 0, y: 0 },
      radius: 5,
    };
    const line = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 5.5, y: -10 },
      end: { x: 5.5, y: 10 },
    };

    const constraints = [
      {
        id: 'c1',
        type: 'tangent' as const,
        targets: [{ geomId: 'l1' }, { geomId: 'c1' }],
      },
      // Fix circle center at (0,0)
      {
        id: 'c2',
        type: 'fixed' as const,
        targets: [{ geomId: 'c1', vertexType: 'center' as const }],
        value: 0,
      },
      // Fix circle radius at 5
      {
        id: 'c3',
        type: 'radius' as const,
        targets: [{ geomId: 'c1' }],
        value: 5,
      },
      // Lock line vertical
      {
        id: 'c4',
        type: 'vertical' as const,
        targets: [{ geomId: 'l1' }],
      },
    ];

    const solved = solveSketch([circle, line], constraints).geometries as any[];
    // The line should solve to x = 5 (exactly tangent to circle of radius 5 at origin)
    expect(solved[1].start.x).toBeCloseTo(5);
    expect(solved[1].end.x).toBeCloseTo(5);
  });

  it('solves angle constraints between lines', () => {
    // Line 1: (0,0) -> (10, 0) - horizontal
    // Line 2: (0,0) -> (10, 10) - 45 degrees
    const line1 = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    const line2 = {
      type: 'line' as const,
      id: 'l2',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    };

    const constraints = [
      // Force line 1 horizontal
      {
        id: 'c1',
        type: 'horizontal' as const,
        targets: [{ geomId: 'l1' }],
      },
      // Fix start point of both lines at (0,0)
      {
        id: 'c2',
        type: 'fixed' as const,
        targets: [{ geomId: 'l1', vertexType: 'start' as const }],
        value: 0,
      },
      {
        id: 'c3',
        type: 'fixed' as const,
        targets: [{ geomId: 'l2', vertexType: 'start' as const }],
        value: 0,
      },
      // Force line length constant to avoid scale changes during rotation
      {
        id: 'c4',
        type: 'distance' as const,
        targets: [
          { geomId: 'l2', vertexType: 'start' as const },
          { geomId: 'l2', vertexType: 'end' as const },
        ],
        value: 10,
      },
      // Fix angle to 60 degrees (Math.PI / 3 = 1.047197)
      {
        id: 'c5',
        type: 'angle' as const,
        targets: [{ geomId: 'l1' }, { geomId: 'l2' }],
        value: Math.PI / 3,
      },
    ];

    const solved = solveSketch([line1, line2], constraints).geometries as any[];
    // Line 2 should rotate to end at (10 * cos(60), 10 * sin(60)) = (5, 8.66)
    expect(solved[1].end.x).toBeCloseTo(5);
    expect(solved[1].end.y).toBeCloseTo(8.66, 1);
  });

  it('solves coincident constraints involving arc endpoints', () => {
    // Line 1 starting near (5, 5), ending near (10, 5)
    // Arc center (5, 5), radius 3, start angle Math.PI/2 (top point: 5, 8)
    const line = {
      type: 'line' as const,
      id: 'l1',
      start: { x: 4.8, y: 8.2 },
      end: { x: 10, y: 5 },
    };
    const arc = {
      type: 'arc' as const,
      id: 'a1',
      center: { x: 5, y: 5 },
      radius: 3,
      startAngle: Math.PI / 2,
      endAngle: (3 * Math.PI) / 2,
    };

    const constraints = [
      // Fix arc center
      {
        id: 'c1',
        type: 'fixed' as const,
        targets: [{ geomId: 'a1', vertexType: 'center' as const }],
        value: 5,
      },
      // Fix arc radius
      {
        id: 'c2',
        type: 'distance' as const,
        targets: [
          { geomId: 'a1', vertexType: 'center' as const },
          { geomId: 'a1', vertexType: 'start' as const },
        ],
        value: 3,
      },
      // Coincident constraint: line start <-> arc start
      {
        id: 'c3',
        type: 'coincident' as const,
        targets: [
          { geomId: 'l1', vertexType: 'start' as const },
          { geomId: 'a1', vertexType: 'start' as const },
        ],
      },
    ];

    const solved = solveSketch([line, arc], constraints).geometries as any[];
    // Top point of arc is (5, 5 + 3) = (5, 8)
    // Line start should be solved to (5, 8)
    expect(solved[0].start.x).toBeCloseTo(5);
    expect(solved[0].start.y).toBeCloseTo(8);
  });
});
