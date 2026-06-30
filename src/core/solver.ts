import type { SketchGeometry } from '../store/types.ts';

/**
 * Represents a geometric or dimensional constraint in a sketch.
 */
export interface SketchConstraint {
  id: string;
  type:
    | 'coincident'
    | 'horizontal'
    | 'vertical'
    | 'distance'
    | 'radius'
    | 'parallel'
    | 'perpendicular'
    | 'point_on_line'
    | 'tangent'
    | 'angle'
    | 'fixed';
  targets: {
    geomId: string;
    vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  }[];
  value?: number; // for dimensional constraints
  xValue?: number;
  yValue?: number;
}

interface Variable {
  geomId: string;
  prop: string; // 'start_x', 'start_y', 'end_x', 'end_y', 'center_x', 'center_y', 'radius'
  value: number;
}

/**
 * Solves a system of geometric constraints on a set of 2D sketch geometries
 * using numerical Newton-Raphson with Moore-Penrose pseudo-inverse.
 * @param geometries The input geometries.
 * @param constraints The constraints to satisfy.
 * @returns The solved geometries.
 */
export function solveSketch(
  geometries: SketchGeometry[],
  constraints: SketchConstraint[],
): { geometries: SketchGeometry[]; dof: number; converged: boolean } {
  // 1. Collect variables
  const variables: Variable[] = [];
  const varMap = new Map<string, number>(); // key: "geomId_prop", value: variable index

  const getVarIndex = (geomId: string, prop: string): number => {
    const key = `${geomId}_${prop}`;
    return varMap.has(key) ? varMap.get(key)! : -1;
  };

  const addVar = (geomId: string, prop: string, val: number) => {
    const idx = variables.length;
    variables.push({ geomId, prop, value: val });
    varMap.set(`${geomId}_${prop}`, idx);
  };

  // Add variables for each geometry
  for (const geom of geometries) {
    if (geom.type === 'line') {
      addVar(geom.id, 'start_x', geom.start.x);
      addVar(geom.id, 'start_y', geom.start.y);
      addVar(geom.id, 'end_x', geom.end.x);
      addVar(geom.id, 'end_y', geom.end.y);
    } else if (geom.type === 'circle') {
      addVar(geom.id, 'center_x', geom.center.x);
      addVar(geom.id, 'center_y', geom.center.y);
      addVar(geom.id, 'radius', geom.radius);
    } else if (geom.type === 'arc') {
      addVar(geom.id, 'center_x', geom.center.x);
      addVar(geom.id, 'center_y', geom.center.y);
      addVar(geom.id, 'radius', geom.radius);
    } else if (geom.type === 'rect') {
      addVar(geom.id, 'start_x', geom.start.x);
      addVar(geom.id, 'start_y', geom.start.y);
      addVar(geom.id, 'end_x', geom.end.x);
      addVar(geom.id, 'end_y', geom.end.y);
    }
  }

  const n = variables.length;

  if (constraints.length === 0) {
    return { geometries, dof: n, converged: true };
  }

  // Helper to get variable values vector
  const getX = (): number[] => variables.map((v) => v.value);

  // Helper to set variable values vector
  const setX = (x: number[]) => {
    for (let i = 0; i < n; i++) {
      variables[i].value = x[i];
    }
  };

  // 2. Define constraint equations
  // Each constraint might output 1 or 2 equations
  interface Equation {
    evaluate: (x: number[]) => number;
    gradient: (x: number[]) => Record<number, number>;
  }

  const equations: Equation[] = [];

  // Helper to resolve point coordinates (either a variable index or a fixed coordinate)
  const resolvePointIndex = (target: {
    geomId: string;
    vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  }): { xIdx: number; yIdx: number; fixedX?: number; fixedY?: number } => {
    const { geomId, vertexType } = target;

    // Handle reference origin
    if (geomId === 'datum_origin') {
      return { xIdx: -1, yIdx: -1, fixedX: 0, fixedY: 0 };
    }

    if (vertexType === 'start') {
      return {
        xIdx: getVarIndex(geomId, 'start_x'),
        yIdx: getVarIndex(geomId, 'start_y'),
      };
    }
    if (vertexType === 'end') {
      return {
        xIdx: getVarIndex(geomId, 'end_x'),
        yIdx: getVarIndex(geomId, 'end_y'),
      };
    }
    if (vertexType === 'center') {
      return {
        xIdx: getVarIndex(geomId, 'center_x'),
        yIdx: getVarIndex(geomId, 'center_y'),
      };
    }
    if (vertexType === 'corner1') {
      // Corner 1: (end.x, start.y)
      return {
        xIdx: getVarIndex(geomId, 'end_x'),
        yIdx: getVarIndex(geomId, 'start_y'),
      };
    }
    if (vertexType === 'corner2') {
      // Corner 2: (start.x, end.y)
      return {
        xIdx: getVarIndex(geomId, 'start_x'),
        yIdx: getVarIndex(geomId, 'end_y'),
      };
    }

    // Default fallbacks (e.g. circle center)
    const cxIdx = getVarIndex(geomId, 'center_x');
    if (cxIdx !== -1) {
      return { xIdx: cxIdx, yIdx: getVarIndex(geomId, 'center_y') };
    }

    // Line start
    const sxIdx = getVarIndex(geomId, 'start_x');
    return { xIdx: sxIdx, yIdx: getVarIndex(geomId, 'start_y') };
  };

  interface PointExpr {
    evaluateX: (x: number[]) => number;
    evaluateY: (x: number[]) => number;
    gradX: (x: number[]) => Record<number, number>;
    gradY: (x: number[]) => Record<number, number>;
  }

  const resolvePointExpr = (target: {
    geomId: string;
    vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
  }): PointExpr => {
    const { geomId, vertexType } = target;

    const geom = geometries.find((g) => g.id === geomId);
    if (geom && geom.type === 'arc') {
      const cxIdx = getVarIndex(geomId, 'center_x');
      const cyIdx = getVarIndex(geomId, 'center_y');
      const rIdx = getVarIndex(geomId, 'radius');

      if (
        cxIdx !== -1 &&
        cyIdx !== -1 &&
        rIdx !== -1 &&
        (vertexType === 'start' || vertexType === 'end')
      ) {
        const theta = vertexType === 'start' ? geom.startAngle : geom.endAngle;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        return {
          evaluateX: (x) => x[cxIdx] + x[rIdx] * cosT,
          evaluateY: (x) => x[cyIdx] + x[rIdx] * sinT,
          gradX: () => ({ [cxIdx]: 1, [rIdx]: cosT }),
          gradY: () => ({ [cyIdx]: 1, [rIdx]: sinT }),
        };
      }
    }

    const p = resolvePointIndex(target);
    return {
      evaluateX: (x) => (p.xIdx !== -1 ? x[p.xIdx] : p.fixedX !== undefined ? p.fixedX : 0),
      evaluateY: (x) => (p.yIdx !== -1 ? x[p.yIdx] : p.fixedY !== undefined ? p.fixedY : 0),
      gradX: () => (p.xIdx !== -1 ? { [p.xIdx]: 1 } : {}),
      gradY: () => (p.yIdx !== -1 ? { [p.yIdx]: 1 } : {}),
    };
  };

  for (const c of constraints) {
    switch (c.type) {
      case 'coincident': {
        if (c.targets.length < 2) break;
        const p1 = resolvePointExpr(c.targets[0]);
        const p2 = resolvePointExpr(c.targets[1]);

        equations.push({
          evaluate: (x) => p1.evaluateX(x) - p2.evaluateX(x),
          gradient: (x) => {
            const g1 = p1.gradX(x);
            const g2 = p2.gradX(x);
            const res = { ...g1 };
            for (const idxStr of Object.keys(g2)) {
              const idx = Number(idxStr);
              res[idx] = (res[idx] || 0) - g2[idx];
            }
            return res;
          },
        });
        equations.push({
          evaluate: (x) => p1.evaluateY(x) - p2.evaluateY(x),
          gradient: (x) => {
            const g1 = p1.gradY(x);
            const g2 = p2.gradY(x);
            const res = { ...g1 };
            for (const idxStr of Object.keys(g2)) {
              const idx = Number(idxStr);
              res[idx] = (res[idx] || 0) - g2[idx];
            }
            return res;
          },
        });
        break;
      }

      case 'horizontal': {
        // Line horizontal: start.y - end.y = 0
        const geomId = c.targets[0].geomId;
        const syIdx = getVarIndex(geomId, 'start_y');
        const eyIdx = getVarIndex(geomId, 'end_y');
        if (syIdx !== -1 && eyIdx !== -1) {
          equations.push({
            evaluate: (x) => x[syIdx] - x[eyIdx],
            gradient: () => ({ [syIdx]: 1, [eyIdx]: -1 }),
          });
        }
        break;
      }

      case 'vertical': {
        // Line vertical: start.x - end.x = 0
        const geomId = c.targets[0].geomId;
        const sxIdx = getVarIndex(geomId, 'start_x');
        const exIdx = getVarIndex(geomId, 'end_x');
        if (sxIdx !== -1 && exIdx !== -1) {
          equations.push({
            evaluate: (x) => x[sxIdx] - x[exIdx],
            gradient: () => ({ [sxIdx]: 1, [exIdx]: -1 }),
          });
        }
        break;
      }

      case 'distance': {
        if (c.targets.length < 2 || c.value === undefined) break;
        const p1 = resolvePointExpr(c.targets[0]);
        const p2 = resolvePointExpr(c.targets[1]);
        const targetDist = c.value;

        equations.push({
          evaluate: (x) => {
            const x1 = p1.evaluateX(x);
            const y1 = p1.evaluateY(x);
            const x2 = p2.evaluateX(x);
            const y2 = p2.evaluateY(x);
            const dx = x1 - x2;
            const dy = y1 - y2;
            return dx * dx + dy * dy - targetDist * targetDist;
          },
          gradient: (x) => {
            const x1 = p1.evaluateX(x);
            const y1 = p1.evaluateY(x);
            const x2 = p2.evaluateX(x);
            const y2 = p2.evaluateY(x);
            const dx = x1 - x2;
            const dy = y1 - y2;

            const g1x = p1.gradX(x);
            const g1y = p1.gradY(x);
            const g2x = p2.gradX(x);
            const g2y = p2.gradY(x);

            const grad: Record<number, number> = {};
            for (const idxStr of Object.keys(g1x)) {
              const idx = Number(idxStr);
              grad[idx] = (grad[idx] || 0) + 2 * dx * g1x[idx];
            }
            for (const idxStr of Object.keys(g2x)) {
              const idx = Number(idxStr);
              grad[idx] = (grad[idx] || 0) - 2 * dx * g2x[idx];
            }
            for (const idxStr of Object.keys(g1y)) {
              const idx = Number(idxStr);
              grad[idx] = (grad[idx] || 0) + 2 * dy * g1y[idx];
            }
            for (const idxStr of Object.keys(g2y)) {
              const idx = Number(idxStr);
              grad[idx] = (grad[idx] || 0) - 2 * dy * g2y[idx];
            }
            return grad;
          },
        });
        break;
      }

      case 'radius': {
        const geomId = c.targets[0].geomId;
        const rIdx = getVarIndex(geomId, 'radius');
        const targetRadius = c.value;
        if (rIdx !== -1 && targetRadius !== undefined) {
          equations.push({
            evaluate: (x) => x[rIdx] - targetRadius,
            gradient: () => ({ [rIdx]: 1 }),
          });
        }
        break;
      }

      case 'point_on_line': {
        if (c.targets.length < 2) break;
        const p = resolvePointExpr(c.targets[0]);
        const lineId = c.targets[1].geomId;
        const sx = getVarIndex(lineId, 'start_x');
        const sy = getVarIndex(lineId, 'start_y');
        const ex = getVarIndex(lineId, 'end_x');
        const ey = getVarIndex(lineId, 'end_y');

        if (sx !== -1 && sy !== -1 && ex !== -1 && ey !== -1) {
          equations.push({
            evaluate: (x) => {
              const px = p.evaluateX(x);
              const py = p.evaluateY(x);
              const lx1 = x[sx];
              const ly1 = x[sy];
              const lx2 = x[ex];
              const ly2 = x[ey];
              return (px - lx1) * (ly2 - ly1) - (py - ly1) * (lx2 - lx1);
            },
            gradient: (x) => {
              const px = p.evaluateX(x);
              const py = p.evaluateY(x);
              const lx1 = x[sx];
              const ly1 = x[sy];
              const lx2 = x[ex];
              const ly2 = x[ey];

              const gp = p.gradX(x);
              const gpy = p.gradY(x);

              const grad: Record<number, number> = {};
              for (const idxStr of Object.keys(gp)) {
                const idx = Number(idxStr);
                grad[idx] = (grad[idx] || 0) + (ly2 - ly1) * gp[idx];
              }
              for (const idxStr of Object.keys(gpy)) {
                const idx = Number(idxStr);
                grad[idx] = (grad[idx] || 0) - (lx2 - lx1) * gpy[idx];
              }

              grad[sx] = py - ly2;
              grad[sy] = lx2 - px;
              grad[ex] = ly1 - py;
              grad[ey] = px - lx1;
              return grad;
            },
          });
        }
        break;
      }

      case 'tangent': {
        if (c.targets.length < 2) break;
        const g1 = c.targets[0].geomId;
        const g2 = c.targets[1].geomId;

        const isCircle1 = getVarIndex(g1, 'radius') !== -1;
        const isCircle2 = getVarIndex(g2, 'radius') !== -1;

        if (!isCircle1 && isCircle2) {
          // Line tangent to Circle
          const sx = getVarIndex(g1, 'start_x');
          const sy = getVarIndex(g1, 'start_y');
          const ex = getVarIndex(g1, 'end_x');
          const ey = getVarIndex(g1, 'end_y');
          const cx = getVarIndex(g2, 'center_x');
          const cy = getVarIndex(g2, 'center_y');
          const r = getVarIndex(g2, 'radius');

          if (
            sx !== -1 &&
            sy !== -1 &&
            ex !== -1 &&
            ey !== -1 &&
            cx !== -1 &&
            cy !== -1 &&
            r !== -1
          ) {
            equations.push({
              evaluate: (x) => {
                const x1 = x[sx];
                const y1 = x[sy];
                const x2 = x[ex];
                const y2 = x[ey];
                const xo = x[cx];
                const yo = x[cy];
                const radius = x[r];
                const num = (y2 - y1) * xo - (x2 - x1) * yo + x2 * y1 - y2 * x1;
                const den = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
                return num * num - radius * radius * den;
              },
              gradient: (x) => {
                const x1 = x[sx];
                const y1 = x[sy];
                const x2 = x[ex];
                const y2 = x[ey];
                const xo = x[cx];
                const yo = x[cy];
                const radius = x[r];
                const num = (y2 - y1) * xo - (x2 - x1) * yo + x2 * y1 - y2 * x1;
                const den = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

                const grad: Record<number, number> = {};
                const dnum_dxo = y2 - y1;
                const dnum_dyo = x1 - x2;
                const dnum_dx1 = yo - y2;
                const dnum_dy1 = x2 - xo;
                const dnum_dx2 = y1 - yo;
                const dnum_dy2 = xo - x1;

                const dden_dx1 = -2 * (x2 - x1);
                const dden_dy1 = -2 * (y2 - y1);
                const dden_dx2 = 2 * (x2 - x1);
                const dden_dy2 = 2 * (y2 - y1);

                grad[cx] = 2 * num * dnum_dxo;
                grad[cy] = 2 * num * dnum_dyo;
                grad[sx] = 2 * num * dnum_dx1 - radius * radius * dden_dx1;
                grad[sy] = 2 * num * dnum_dy1 - radius * radius * dden_dy1;
                grad[ex] = 2 * num * dnum_dx2 - radius * radius * dden_dx2;
                grad[ey] = 2 * num * dnum_dy2 - radius * radius * dden_dy2;
                grad[r] = -2 * radius * den;
                return grad;
              },
            });
          }
        } else if (isCircle1 && isCircle2) {
          // Circle tangent to Circle
          const cx1 = getVarIndex(g1, 'center_x');
          const cy1 = getVarIndex(g1, 'center_y');
          const r1 = getVarIndex(g1, 'radius');
          const cx2 = getVarIndex(g2, 'center_x');
          const cy2 = getVarIndex(g2, 'center_y');
          const r2 = getVarIndex(g2, 'radius');

          if (cx1 !== -1 && cy1 !== -1 && r1 !== -1 && cx2 !== -1 && cy2 !== -1 && r2 !== -1) {
            equations.push({
              evaluate: (x) => {
                const x1 = x[cx1];
                const y1 = x[cy1];
                const radius1 = x[r1];
                const x2 = x[cx2];
                const y2 = x[cy2];
                const radius2 = x[r2];
                const dx = x1 - x2;
                const dy = y1 - y2;
                const rSum = radius1 + radius2;
                return dx * dx + dy * dy - rSum * rSum;
              },
              gradient: (x) => {
                const x1 = x[cx1];
                const y1 = x[cy1];
                const radius1 = x[r1];
                const x2 = x[cx2];
                const y2 = x[cy2];
                const radius2 = x[r2];
                const dx = x1 - x2;
                const dy = y1 - y2;
                const rSum = radius1 + radius2;

                const grad: Record<number, number> = {};
                grad[cx1] = 2 * dx;
                grad[cx2] = -2 * dx;
                grad[cy1] = 2 * dy;
                grad[cy2] = -2 * dy;
                grad[r1] = -2 * rSum;
                grad[r2] = -2 * rSum;
                return grad;
              },
            });
          }
        }
        break;
      }

      case 'parallel': {
        if (c.targets.length < 2) break;
        const g1 = c.targets[0].geomId;
        const g2 = c.targets[1].geomId;
        const sx1 = getVarIndex(g1, 'start_x');
        const sy1 = getVarIndex(g1, 'start_y');
        const ex1 = getVarIndex(g1, 'end_x');
        const ey1 = getVarIndex(g1, 'end_y');
        const sx2 = getVarIndex(g2, 'start_x');
        const sy2 = getVarIndex(g2, 'start_y');
        const ex2 = getVarIndex(g2, 'end_x');
        const ey2 = getVarIndex(g2, 'end_y');

        if (
          sx1 !== -1 &&
          sy1 !== -1 &&
          ex1 !== -1 &&
          ey1 !== -1 &&
          sx2 !== -1 &&
          sy2 !== -1 &&
          ex2 !== -1 &&
          ey2 !== -1
        ) {
          equations.push({
            evaluate: (x) => {
              const dx1 = x[ex1] - x[sx1];
              const dy1 = x[ey1] - x[sy1];
              const dx2 = x[ex2] - x[sx2];
              const dy2 = x[ey2] - x[sy2];
              // Cross product = 0
              return dx1 * dy2 - dy1 * dx2;
            },
            gradient: (x) => {
              const dx1 = x[ex1] - x[sx1];
              const dy1 = x[ey1] - x[sy1];
              const dx2 = x[ex2] - x[sx2];
              const dy2 = x[ey2] - x[sy2];
              const grad: Record<number, number> = {};
              grad[ex1] = dy2;
              grad[sx1] = -dy2;
              grad[ey1] = -dx2;
              grad[sy1] = dx2;
              grad[ex2] = -dy1;
              grad[sx2] = dy1;
              grad[ey2] = dx1;
              grad[sy2] = -dx1;
              return grad;
            },
          });
        }
        break;
      }

      case 'perpendicular': {
        if (c.targets.length < 2) break;
        const g1 = c.targets[0].geomId;
        const g2 = c.targets[1].geomId;
        const sx1 = getVarIndex(g1, 'start_x');
        const sy1 = getVarIndex(g1, 'start_y');
        const ex1 = getVarIndex(g1, 'end_x');
        const ey1 = getVarIndex(g1, 'end_y');
        const sx2 = getVarIndex(g2, 'start_x');
        const sy2 = getVarIndex(g2, 'start_y');
        const ex2 = getVarIndex(g2, 'end_x');
        const ey2 = getVarIndex(g2, 'end_y');

        if (
          sx1 !== -1 &&
          sy1 !== -1 &&
          ex1 !== -1 &&
          ey1 !== -1 &&
          sx2 !== -1 &&
          sy2 !== -1 &&
          ex2 !== -1 &&
          ey2 !== -1
        ) {
          equations.push({
            evaluate: (x) => {
              const dx1 = x[ex1] - x[sx1];
              const dy1 = x[ey1] - x[sy1];
              const dx2 = x[ex2] - x[sx2];
              const dy2 = x[ey2] - x[sy2];
              // Dot product = 0
              return dx1 * dx2 + dy1 * dy2;
            },
            gradient: (x) => {
              const dx1 = x[ex1] - x[sx1];
              const dy1 = x[ey1] - x[sy1];
              const dx2 = x[ex2] - x[sx2];
              const dy2 = x[ey2] - x[sy2];
              const grad: Record<number, number> = {};
              grad[ex1] = dx2;
              grad[sx1] = -dx2;
              grad[ey1] = dy2;
              grad[sy1] = -dy2;
              grad[ex2] = dx1;
              grad[sx2] = -dx1;
              grad[ey2] = dy1;
              grad[sy2] = -dy1;
              return grad;
            },
          });
        }
        break;
      }

      case 'angle': {
        if (c.targets.length < 2 || c.value === undefined) break;
        const g1 = c.targets[0].geomId;
        const g2 = c.targets[1].geomId;
        const sx1 = getVarIndex(g1, 'start_x');
        const sy1 = getVarIndex(g1, 'start_y');
        const ex1 = getVarIndex(g1, 'end_x');
        const ey1 = getVarIndex(g1, 'end_y');
        const sx2 = getVarIndex(g2, 'start_x');
        const sy2 = getVarIndex(g2, 'start_y');
        const ex2 = getVarIndex(g2, 'end_x');
        const ey2 = getVarIndex(g2, 'end_y');

        if (
          sx1 !== -1 &&
          sy1 !== -1 &&
          ex1 !== -1 &&
          ey1 !== -1 &&
          sx2 !== -1 &&
          sy2 !== -1 &&
          ex2 !== -1 &&
          ey2 !== -1
        ) {
          const targetAngle = c.value;
          equations.push({
            evaluate: (x) => {
              const dx1 = x[ex1] - x[sx1];
              const dy1 = x[ey1] - x[sy1];
              const dx2 = x[ex2] - x[sx2];
              const dy2 = x[ey2] - x[sy2];

              const dotProd = dx1 * dx2 + dy1 * dy2;
              const len1Sqr = dx1 * dx1 + dy1 * dy1;
              const len2Sqr = dx2 * dx2 + dy2 * dy2;

              const cosTheta = Math.cos(targetAngle);
              return dotProd - Math.sqrt(len1Sqr * len2Sqr) * cosTheta;
            },
            gradient: (x) => {
              const dx1 = x[ex1] - x[sx1];
              const dy1 = x[ey1] - x[sy1];
              const dx2 = x[ex2] - x[sx2];
              const dy2 = x[ey2] - x[sy2];

              const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1e-9;
              const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1e-9;
              const cosTheta = Math.cos(targetAngle);

              const grad: Record<number, number> = {};
              const df_dex1 = dx2 - (dx1 / len1) * len2 * cosTheta;
              const df_dey1 = dy2 - (dy1 / len1) * len2 * cosTheta;
              const df_dex2 = dx1 - (dx2 / len2) * len1 * cosTheta;
              const df_dey2 = dy1 - (dy2 / len2) * len1 * cosTheta;

              grad[ex1] = df_dex1;
              grad[sx1] = -df_dex1;
              grad[ey1] = df_dey1;
              grad[sy1] = -df_dey1;
              grad[ex2] = df_dex2;
              grad[sx2] = -df_dex2;
              grad[ey2] = df_dey2;
              grad[sy2] = -df_dey2;
              return grad;
            },
          });
        }
        break;
      }

      case 'fixed': {
        const p = resolvePointExpr(c.targets[0]);
        const fx = c.xValue !== undefined ? c.xValue : c.value !== undefined ? c.value : 0;
        const fy = c.yValue !== undefined ? c.yValue : c.value !== undefined ? c.value : 0;

        equations.push({
          evaluate: (x) => p.evaluateX(x) - fx,
          gradient: (x) => p.gradX(x),
        });
        equations.push({
          evaluate: (x) => p.evaluateY(x) - fy,
          gradient: (x) => p.gradY(x),
        });
        break;
      }

      default:
        break;
    }
  }

  const m = equations.length;
  if (m === 0) return { geometries, dof: n, converged: true };

  // 3. Newton-Raphson Solver loop
  const maxIterations = 50;
  const tolerance = 1e-6;

  for (let iter = 0; iter < maxIterations; iter++) {
    const x = getX();

    // Evaluate error vector F(x)
    const fVals = equations.map((eq) => eq.evaluate(x));
    let totalError = 0;
    for (const v of fVals) {
      totalError += v * v;
    }
    if (Math.sqrt(totalError) < tolerance) {
      break; // converged!
    }

    // Compute Jacobian matrix J (m x n) analytically
    const J: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      const grad = equations[i].gradient(x);
      for (const idxStr of Object.keys(grad)) {
        const idx = Number(idxStr);
        if (idx >= 0 && idx < n) {
          J[i][idx] = grad[idx];
        }
      }
    }

    // Solve J * dx = -F.
    // Under-constrained (m < n) or over-constrained:
    // We use least-squares pseudo-inverse update:
    // dx = J^T * (J * J^T + lambda*I)^-1 * (-F)
    // where lambda is a small damping factor for Levenberg-Marquardt style stability.
    const lambda = 1e-9;

    // Compute A = J * J^T (m x m)
    const A: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let k = 0; k < m; k++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += J[i][j] * J[k][j];
        }
        A[i][k] = sum;
      }
      A[i][i] += lambda; // add regularization
    }

    // Solve A * y = -F using Gaussian Elimination
    const y = solveLinearSystem(
      A,
      fVals.map((v) => -v),
    );
    if (!y) {
      break; // singular matrix or solve failed
    }

    // dx = J^T * y
    const dx = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let i = 0; i < m; i++) {
        sum += J[i][j] * y[i];
      }
      dx[j] = sum;
    }

    // Update X
    const newX = x.map((val, idx) => val + dx[idx]);
    setX(newX);
  }

  // 4. Update and calculate DOF and convergence
  const finalGeoms = geometries.map((geom) => {
    if (geom.type === 'line') {
      return {
        ...geom,
        start: {
          x: variables[getVarIndex(geom.id, 'start_x')].value,
          y: variables[getVarIndex(geom.id, 'start_y')].value,
        },
        end: {
          x: variables[getVarIndex(geom.id, 'end_x')].value,
          y: variables[getVarIndex(geom.id, 'end_y')].value,
        },
      };
    } else if (geom.type === 'circle') {
      return {
        ...geom,
        center: {
          x: variables[getVarIndex(geom.id, 'center_x')].value,
          y: variables[getVarIndex(geom.id, 'center_y')].value,
        },
        radius: variables[getVarIndex(geom.id, 'radius')].value,
      };
    } else if (geom.type === 'arc') {
      return {
        ...geom,
        center: {
          x: variables[getVarIndex(geom.id, 'center_x')].value,
          y: variables[getVarIndex(geom.id, 'center_y')].value,
        },
        radius: variables[getVarIndex(geom.id, 'radius')].value,
      };
    } else if (geom.type === 'rect') {
      return {
        ...geom,
        start: {
          x: variables[getVarIndex(geom.id, 'start_x')].value,
          y: variables[getVarIndex(geom.id, 'start_y')].value,
        },
        end: {
          x: variables[getVarIndex(geom.id, 'end_x')].value,
          y: variables[getVarIndex(geom.id, 'end_y')].value,
        },
      };
    }
    return geom;
  });

  // Calculate convergence error
  const finalX = getX();
  const finalFVals = equations.map((eq) => eq.evaluate(finalX));
  let finalError = 0;
  for (const v of finalFVals) {
    finalError += v * v;
  }
  const converged = Math.sqrt(finalError) < tolerance;

  // Calculate analytic Jacobian rank for DOF computation
  const J: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    const grad = equations[i].gradient(finalX);
    for (const idxStr of Object.keys(grad)) {
      const idx = Number(idxStr);
      if (idx >= 0 && idx < n) {
        J[i][idx] = grad[idx];
      }
    }
  }

  const rank = computeMatrixRank(J);
  const dof = Math.max(0, n - rank);

  return { geometries: finalGeoms, dof, converged };
}

/**
 * Computes the rank of a matrix using Gaussian elimination with partial pivoting.
 */
function computeMatrixRank(matrix: number[][], tolerance = 1e-5): number {
  const m = matrix.length;
  if (m === 0) return 0;
  const n = matrix[0].length;
  if (n === 0) return 0;

  // Clone matrix
  const A = matrix.map((row) => [...row]);

  let rank = 0;
  let col = 0;
  for (let row = 0; row < m; row++) {
    while (col < n) {
      let pivotRow = row;
      for (let r = row + 1; r < m; r++) {
        if (Math.abs(A[r][col]) > Math.abs(A[pivotRow][col])) {
          pivotRow = r;
        }
      }

      if (Math.abs(A[pivotRow][col]) > tolerance) {
        // Swap rows
        const temp = A[row];
        A[row] = A[pivotRow];
        A[pivotRow] = temp;

        // Eliminate
        for (let r = row + 1; r < m; r++) {
          const factor = A[r][col] / A[row][col];
          for (let c = col; c < n; c++) {
            A[r][c] -= factor * A[row][c];
          }
        }
        rank++;
        col++;
        break;
      }
      col++;
    }
  }
  return rank;
}

/**
 * Solves a linear system M * y = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(M: number[][], b: number[]): number[] | null {
  const s = M.length;
  // Augmented matrix
  const aug: number[][] = Array.from({ length: s }, (_, i) => [...M[i], b[i]]);

  for (let i = 0; i < s; i++) {
    // Pivot
    let maxRow = i;
    for (let r = i + 1; r < s; r++) {
      if (Math.abs(aug[r][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = r;
      }
    }

    // Swap rows
    const temp = aug[i];
    aug[i] = aug[maxRow];
    aug[maxRow] = temp;

    if (Math.abs(aug[i][i]) < 1e-12) {
      return null; // singular or close to singular matrix
    }

    // Eliminate below
    for (let r = i + 1; r < s; r++) {
      const factor = aug[r][i] / aug[i][i];
      for (let c = i; c <= s; c++) {
        aug[r][c] -= factor * aug[i][c];
      }
    }
  }

  // Back substitution
  const y = Array(s).fill(0);
  for (let i = s - 1; i >= 0; i--) {
    let sum = aug[i][s];
    for (let j = i + 1; j < s; j++) {
      sum -= aug[i][j] * y[j];
    }
    y[i] = sum / aug[i][i];
  }

  return y;
}
