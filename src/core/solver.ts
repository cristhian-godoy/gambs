import { SketchGeometry } from '../store/types.ts';

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
): SketchGeometry[] {
  if (constraints.length === 0) {
    return geometries;
  }

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
    } else if (geom.type === 'rect') {
      addVar(geom.id, 'start_x', geom.start.x);
      addVar(geom.id, 'start_y', geom.start.y);
      addVar(geom.id, 'end_x', geom.end.x);
      addVar(geom.id, 'end_y', geom.end.y);
    }
  }

  const n = variables.length;
  if (n === 0) return geometries;

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

  for (const c of constraints) {
    switch (c.type) {
      case 'coincident': {
        if (c.targets.length < 2) break;
        const p1 = resolvePointIndex(c.targets[0]);
        const p2 = resolvePointIndex(c.targets[1]);

        equations.push({
          evaluate: (x) => {
            const x1 = p1.xIdx !== -1 ? x[p1.xIdx] : p1.fixedX!;
            const x2 = p2.xIdx !== -1 ? x[p2.xIdx] : p2.fixedX!;
            return x1 - x2;
          },
        });
        equations.push({
          evaluate: (x) => {
            const y1 = p1.yIdx !== -1 ? x[p1.yIdx] : p1.fixedY!;
            const y2 = p2.yIdx !== -1 ? x[p2.yIdx] : p2.fixedY!;
            return y1 - y2;
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
          });
        }
        break;
      }

      case 'distance': {
        if (c.targets.length < 2 || c.value === undefined) break;
        const p1 = resolvePointIndex(c.targets[0]);
        const p2 = resolvePointIndex(c.targets[1]);
        const targetDist = c.value;

        equations.push({
          evaluate: (x) => {
            const x1 = p1.xIdx !== -1 ? x[p1.xIdx] : p1.fixedX!;
            const y1 = p1.yIdx !== -1 ? x[p1.yIdx] : p1.fixedY!;
            const x2 = p2.xIdx !== -1 ? x[p2.xIdx] : p2.fixedX!;
            const y2 = p2.yIdx !== -1 ? x[p2.yIdx] : p2.fixedY!;
            const dx = x1 - x2;
            const dy = y1 - y2;
            return dx * dx + dy * dy - targetDist * targetDist;
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
          });
        }
        break;
      }

      case 'point_on_line': {
        if (c.targets.length < 2) break;
        const p = resolvePointIndex(c.targets[0]);
        const lineId = c.targets[1].geomId;
        const sx = getVarIndex(lineId, 'start_x');
        const sy = getVarIndex(lineId, 'start_y');
        const ex = getVarIndex(lineId, 'end_x');
        const ey = getVarIndex(lineId, 'end_y');

        if (sx !== -1 && sy !== -1 && ex !== -1 && ey !== -1) {
          equations.push({
            evaluate: (x) => {
              const px = p.xIdx !== -1 ? x[p.xIdx] : p.fixedX!;
              const py = p.yIdx !== -1 ? x[p.yIdx] : p.fixedY!;
              const lx1 = x[sx];
              const ly1 = x[sy];
              const lx2 = x[ex];
              const ly2 = x[ey];
              return (px - lx1) * (ly2 - ly1) - (py - ly1) * (lx2 - lx1);
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
          });
        }
        break;
      }

      case 'fixed': {
        const p = resolvePointIndex(c.targets[0]);
        const fx = c.value !== undefined ? c.value : 0;
        const fy = c.value !== undefined ? c.value : 0; // standard fixed can pass coordinate properties, default to 0

        if (p.xIdx !== -1) {
          equations.push({
            evaluate: (x) => x[p.xIdx] - fx,
          });
        }
        if (p.yIdx !== -1) {
          equations.push({
            evaluate: (x) => x[p.yIdx] - fy,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  const m = equations.length;
  if (m === 0) return geometries;

  // 3. Newton-Raphson Solver loop
  const maxIterations = 50;
  const tolerance = 1e-6;
  const h = 1e-8; // step size for numerical differentiation

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

    // Compute Jacobian matrix J (m x n) numerically
    const J: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        // Central difference
        const temp = x[j];
        x[j] = temp + h;
        const fPlus = equations[i].evaluate(x);
        x[j] = temp - h;
        const fMinus = equations[i].evaluate(x);
        x[j] = temp; // restore
        J[i][j] = (fPlus - fMinus) / (2 * h);
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

  // 4. Update and return geometries
  return geometries.map((geom) => {
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
