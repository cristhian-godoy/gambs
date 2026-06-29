import type { Feature, SketchGeometry } from '../store/types.ts';

/**
 * Represents a 3D vertex with coordinates.
 */
export interface Vertex3D {
  id: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Represents a 3D geometric edge linking two vertices.
 */
export interface Edge3D {
  id: string;
  type: 'line' | 'arc' | 'circle';
  startVertexId: string;
  endVertexId: string;
  center?: { x: number; y: number; z: number };
  radius?: number;
}

/**
 * Represents a closed loop wire composed of edges.
 */
export interface Wire3D {
  id: string;
  edgeIds: string[];
}

/**
 * Represents a 3D solid face bounded by wires.
 */
export interface Face3D {
  id: string;
  outerWireId: string;
  innerWireIds: string[];
  normal: { x: number; y: number; z: number };
}

/**
 * Represents a shell composed of connected faces.
 */
export interface Shell3D {
  id: string;
  faceIds: string[];
}

/**
 * Represents a 3D solid shape containing a shell.
 */
export interface Solid3D {
  id: string;
  shellId: string;
}

/**
 * High-fidelity 3D Boundary Representation (B-Rep) solid structure.
 */
export interface BrepShape {
  vertices: Vertex3D[];
  edges: Edge3D[];
  wires: Wire3D[];
  faces: Face3D[];
  shells: Shell3D[];
  solids: Solid3D[];
}

function getPlaneMapping(supportPlaneId?: string) {
  if (supportPlaneId === 'datum_plane_yz') {
    return {
      project: (u: number, v: number, w: number) => ({ x: w, y: u, z: v }),
      normal: { x: 1, y: 0, z: 0 },
    };
  }
  if (supportPlaneId === 'datum_plane_zx') {
    return {
      project: (u: number, v: number, w: number) => ({ x: v, y: w, z: u }),
      normal: { x: 0, y: 1, z: 0 },
    };
  }
  return {
    project: (u: number, v: number, w: number) => ({ x: u, y: v, z: w }),
    normal: { x: 0, y: 0, z: 1 },
  };
}

function mapNormal(nx: number, ny: number, nz: number, supportPlaneId?: string) {
  if (supportPlaneId === 'datum_plane_yz') {
    return { x: nz, y: nx, z: ny };
  }
  if (supportPlaneId === 'datum_plane_zx') {
    return { x: ny, y: nz, z: nx };
  }
  return { x: nx, y: ny, z: nz };
}

/**
 * Builds a B-Rep cylinder or box shape by extruding a 2D sketch profile.
 * @param profile Wires/shapes from sketch.
 * @param depth Distance to extrude along Z axis.
 * @returns B-Rep solid shape.
 */
export function extrudeProfile(
  profile: SketchGeometry[],
  depth: number,
  featureId: string = 'extrude',
  supportPlaneId?: string,
): BrepShape {
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];
  const wires: Wire3D[] = [];
  const faces: Face3D[] = [];
  const shells: Shell3D[] = [];
  const solids: Solid3D[] = [];

  const shellFaceIds: string[] = [];
  const mapping = getPlaneMapping(supportPlaneId);

  // Helper to add vertex
  const addVertex = (p: { x: number; y: number; z: number }, geomId: string = ''): string => {
    const id = `v_${vertices.length}_${featureId}${geomId ? `_${geomId}` : ''}`;
    vertices.push({ id, ...p });
    return id;
  };

  // Helper to add edge
  const addEdge = (
    type: 'line' | 'arc' | 'circle',
    startId: string,
    endId: string,
    geomId: string = '',
    extra?: Partial<Edge3D>,
  ): string => {
    const id = `e_${edges.length}_${featureId}${geomId ? `_${geomId}` : ''}`;
    edges.push({ id, type, startVertexId: startId, endVertexId: endId, ...extra });
    return id;
  };

  // Process each 2D shape in the profile
  for (const geom of profile) {
    if (geom.type === 'rect') {
      // Extruding a rectangle creates a rectangular prism (box)
      const x1 = Math.min(geom.start.x, geom.end.x);
      const x2 = Math.max(geom.start.x, geom.end.x);
      const y1 = Math.min(geom.start.y, geom.end.y);
      const y2 = Math.max(geom.start.y, geom.end.y);

      // Vertices
      const b00 = addVertex(mapping.project(x1, y1, 0), `${geom.id}_b00`);
      const b10 = addVertex(mapping.project(x2, y1, 0), `${geom.id}_b10`);
      const b11 = addVertex(mapping.project(x2, y2, 0), `${geom.id}_b11`);
      const b01 = addVertex(mapping.project(x1, y2, 0), `${geom.id}_b01`);

      const t00 = addVertex(mapping.project(x1, y1, depth), `${geom.id}_t00`);
      const t10 = addVertex(mapping.project(x2, y1, depth), `${geom.id}_t10`);
      const t11 = addVertex(mapping.project(x2, y2, depth), `${geom.id}_t11`);
      const t01 = addVertex(mapping.project(x1, y2, depth), `${geom.id}_t01`);

      // Edges
      const be1 = addEdge('line', b00, b10, `${geom.id}_be1`);
      const be2 = addEdge('line', b10, b11, `${geom.id}_be2`);
      const be3 = addEdge('line', b11, b01, `${geom.id}_be3`);
      const be4 = addEdge('line', b01, b00, `${geom.id}_be4`);

      const te1 = addEdge('line', t00, t10, `${geom.id}_te1`);
      const te2 = addEdge('line', t10, t11, `${geom.id}_te2`);
      const te3 = addEdge('line', t11, t01, `${geom.id}_te3`);
      const te4 = addEdge('line', t01, t00, `${geom.id}_te4`);

      const se1 = addEdge('line', b00, t00, `${geom.id}_se1`);
      const se2 = addEdge('line', b10, t10, `${geom.id}_se2`);
      const se3 = addEdge('line', b11, t11, `${geom.id}_se3`);
      const se4 = addEdge('line', b01, t01, `${geom.id}_se4`);

      // Wires & Faces
      const bottomWireId = `w_bottom_${featureId}_${geom.id}`;
      wires.push({ id: bottomWireId, edgeIds: [be1, be2, be3, be4] });
      const bottomFaceId = `f_bottom_${featureId}_${geom.id}`;
      faces.push({
        id: bottomFaceId,
        outerWireId: bottomWireId,
        innerWireIds: [],
        normal: mapNormal(0, 0, -1, supportPlaneId),
      });
      shellFaceIds.push(bottomFaceId);

      const topWireId = `w_top_${featureId}_${geom.id}`;
      wires.push({ id: topWireId, edgeIds: [te1, te2, te3, te4] });
      const topFaceId = `f_top_${featureId}_${geom.id}`;
      faces.push({
        id: topFaceId,
        outerWireId: topWireId,
        innerWireIds: [],
        normal: mapNormal(0, 0, 1, supportPlaneId),
      });
      shellFaceIds.push(topFaceId);

      const wSide1 = `w_s1_${featureId}_${geom.id}`;
      wires.push({ id: wSide1, edgeIds: [be1, se2, te1, se1] });
      const fSide1 = `f_s1_${featureId}_${geom.id}`;
      faces.push({
        id: fSide1,
        outerWireId: wSide1,
        innerWireIds: [],
        normal: mapNormal(0, -1, 0, supportPlaneId),
      });
      shellFaceIds.push(fSide1);

      const wSide2 = `w_s2_${featureId}_${geom.id}`;
      wires.push({ id: wSide2, edgeIds: [be2, se3, te2, se2] });
      const fSide2 = `f_s2_${featureId}_${geom.id}`;
      faces.push({
        id: fSide2,
        outerWireId: wSide2,
        innerWireIds: [],
        normal: mapNormal(1, 0, 0, supportPlaneId),
      });
      shellFaceIds.push(fSide2);

      const wSide3 = `w_s3_${featureId}_${geom.id}`;
      wires.push({ id: wSide3, edgeIds: [be3, se4, te3, se3] });
      const fSide3 = `f_s3_${featureId}_${geom.id}`;
      faces.push({
        id: fSide3,
        outerWireId: wSide3,
        innerWireIds: [],
        normal: mapNormal(0, 1, 0, supportPlaneId),
      });
      shellFaceIds.push(fSide3);

      const wSide4 = `w_s4_${featureId}_${geom.id}`;
      wires.push({ id: wSide4, edgeIds: [be4, se1, te4, se4] });
      const fSide4 = `f_s4_${featureId}_${geom.id}`;
      faces.push({
        id: fSide4,
        outerWireId: wSide4,
        innerWireIds: [],
        normal: mapNormal(-1, 0, 0, supportPlaneId),
      });
      shellFaceIds.push(fSide4);
    } else if (geom.type === 'circle') {
      const { center, radius } = geom;

      const bCenter = addVertex(mapping.project(center.x, center.y, 0), `${geom.id}_bCenter`);
      const tCenter = addVertex(mapping.project(center.x, center.y, depth), `${geom.id}_tCenter`);

      const be = addEdge('circle', bCenter, bCenter, `${geom.id}_be`, {
        center: mapping.project(center.x, center.y, 0),
        radius,
      });
      const te = addEdge('circle', tCenter, tCenter, `${geom.id}_te`, {
        center: mapping.project(center.x, center.y, depth),
        radius,
      });

      const bottomWireId = `w_bottom_c_${featureId}_${geom.id}`;
      wires.push({ id: bottomWireId, edgeIds: [be] });
      const bottomFaceId = `f_bottom_c_${featureId}_${geom.id}`;
      faces.push({
        id: bottomFaceId,
        outerWireId: bottomWireId,
        innerWireIds: [],
        normal: mapNormal(0, 0, -1, supportPlaneId),
      });
      shellFaceIds.push(bottomFaceId);

      const topWireId = `w_top_c_${featureId}_${geom.id}`;
      wires.push({ id: topWireId, edgeIds: [te] });
      const topFaceId = `f_top_c_${featureId}_${geom.id}`;
      faces.push({
        id: topFaceId,
        outerWireId: topWireId,
        innerWireIds: [],
        normal: mapNormal(0, 0, 1, supportPlaneId),
      });
      shellFaceIds.push(topFaceId);

      const sideWireId = `w_side_c_${featureId}_${geom.id}`;
      wires.push({ id: sideWireId, edgeIds: [be, te] });
      const sideFaceId = `f_side_c_${featureId}_${geom.id}`;
      faces.push({
        id: sideFaceId,
        outerWireId: sideWireId,
        innerWireIds: [],
        normal: mapNormal(1, 0, 0, supportPlaneId),
      });
      shellFaceIds.push(sideFaceId);
    }
  }

  if (shellFaceIds.length > 0) {
    const shellId = `shell_${featureId}`;
    shells.push({ id: shellId, faceIds: shellFaceIds });
    const solidId = `solid_${featureId}`;
    solids.push({ id: solidId, shellId });
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Mock pocket operation that subtracts a 2D profile from a base solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param profile Wires/shapes from sketch.
 * @param depth Subtract pocket depth.
 * @returns Modified B-Rep shape.
 */
export function pocketProfile(
  baseSolid: BrepShape,
  profile: SketchGeometry[],
  depth: number,
  featureId: string = 'pocket',
  supportPlaneId?: string,
): BrepShape {
  const pocketExtrusion = extrudeProfile(profile, depth, featureId, supportPlaneId);

  if (pocketExtrusion.vertices.length === 0) return baseSolid;

  const vertices = baseSolid.vertices.map((v) => {
    for (const geom of profile) {
      if (geom.type === 'rect') {
        const x1 = Math.min(geom.start.x, geom.end.x);
        const x2 = Math.max(geom.start.x, geom.end.x);
        const y1 = Math.min(geom.start.y, geom.end.y);
        const y2 = Math.max(geom.start.y, geom.end.y);

        if (v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2) {
          return { ...v, z: Math.max(0, v.z - depth) };
        }
      } else if (geom.type === 'circle') {
        const dx = v.x - geom.center.x;
        const dy = v.y - geom.center.y;
        if (dx * dx + dy * dy <= geom.radius * geom.radius) {
          return { ...v, z: Math.max(0, v.z - depth) };
        }
      }
    }
    return v;
  });

  return {
    ...baseSolid,
    vertices,
  };
}

/**
 * Validates whether a profile crosses the axis of rotation.
 * @param profile Sketch geometries.
 * @param axis Rotation axis ('X' | 'Y').
 * @returns Error message if invalid, or null.
 */
export function validateRotationProfile(profile: SketchGeometry[], axis: 'X' | 'Y'): string | null {
  for (const geom of profile) {
    if (geom.type === 'rect') {
      const val1 = axis === 'Y' ? geom.start.x : geom.start.y;
      const val2 = axis === 'Y' ? geom.end.x : geom.end.y;
      if ((val1 < 0 && val2 > 0) || (val1 > 0 && val2 < 0) || val1 === 0 || val2 === 0) {
        return `Profile crosses or touches the rotation axis (${axis}). This produces invalid self-intersecting geometries.`;
      }
    } else if (geom.type === 'circle') {
      const centerVal = axis === 'Y' ? geom.center.x : geom.center.y;
      const r = geom.radius;
      if (Math.abs(centerVal) <= r) {
        return `Profile crosses or touches the rotation axis (${axis}). This produces invalid self-intersecting geometries.`;
      }
    }
  }
  return null;
}

/**
 * Samples a 2D sketch profile into a list of points.
 * @param profile Sketch geometries.
 * @param M Number of samples.
 * @returns Sampled 2D points.
 */
export function sampleProfileToPoints(
  profile: SketchGeometry[],
  M: number = 32,
): { x: number; y: number }[] {
  if (profile.length === 0) return [];
  const geom = profile[0];
  const pts: { x: number; y: number }[] = [];

  if (geom.type === 'rect') {
    const x1 = Math.min(geom.start.x, geom.end.x);
    const x2 = Math.max(geom.start.x, geom.end.x);
    const y1 = Math.min(geom.start.y, geom.end.y);
    const y2 = Math.max(geom.start.y, geom.end.y);

    const w = x2 - x1;
    const h = y2 - y1;
    const perimeter = 2 * (w + h);

    for (let i = 0; i < M; i++) {
      const dist = (i * perimeter) / M;
      if (dist < w) {
        pts.push({ x: x1 + dist, y: y1 });
      } else if (dist < w + h) {
        pts.push({ x: x2, y: y1 + (dist - w) });
      } else if (dist < 2 * w + h) {
        pts.push({ x: x2 - (dist - w - h), y: y2 });
      } else {
        pts.push({ x: x1, y: y2 - (dist - 2 * w - h) });
      }
    }
  } else if (geom.type === 'circle') {
    const cx = geom.center.x;
    const cy = geom.center.y;
    const r = geom.radius;
    for (let i = 0; i < M; i++) {
      const angle = (i * Math.PI * 2) / M;
      pts.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    }
  } else if (geom.type === 'line') {
    const x1 = geom.start.x;
    const y1 = geom.start.y;
    const x2 = geom.end.x;
    const y2 = geom.end.y;
    for (let i = 0; i < M; i++) {
      const t = i / (M - 1 || 1);
      pts.push({
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      });
    }
  }

  return pts;
}

/**
 * Builds a B-Rep solid shape by revolving a 2D sketch profile around an axis.
 * @param profile Wires/shapes from sketch.
 * @param angle Rotation angle in degrees (0 to 360).
 * @param axis Rotation axis ('X' | 'Y').
 * @returns B-Rep solid shape.
 */
export function revolveProfile(
  profile: SketchGeometry[],
  angle: number = 360,
  axis: 'X' | 'Y' = 'Y',
  featureId: string = 'revolve',
): BrepShape {
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];
  const wires: Wire3D[] = [];
  const faces: Face3D[] = [];
  const shells: Shell3D[] = [];
  const solids: Solid3D[] = [];

  const shellFaceIds: string[] = [];

  const radAngle = (angle * Math.PI) / 180;
  const segments = 32;
  const isFullRevolve = Math.abs(angle - 360) < 0.001;

  const addVertex = (x: number, y: number, z: number, geomId: string = ''): string => {
    const id = `rv_${vertices.length}_${featureId}${geomId ? `_${geomId}` : ''}`;
    vertices.push({ id, x, y, z });
    return id;
  };

  const addEdge = (
    type: 'line' | 'arc' | 'circle',
    startId: string,
    endId: string,
    geomId: string = '',
    extra?: Partial<Edge3D>,
  ): string => {
    const id = `re_${edges.length}_${featureId}${geomId ? `_${geomId}` : ''}`;
    edges.push({ id, type, startVertexId: startId, endVertexId: endId, ...extra });
    return id;
  };

  const rotatePoint = (px: number, py: number, theta: number) => {
    if (axis === 'X') {
      return {
        x: px,
        y: py * Math.cos(theta),
        z: py * Math.sin(theta),
      };
    } else {
      return {
        x: px * Math.cos(theta),
        y: py,
        z: px * Math.sin(theta),
      };
    }
  };

  for (const geom of profile) {
    if (geom.type === 'rect') {
      const x1 = Math.min(geom.start.x, geom.end.x);
      const x2 = Math.max(geom.start.x, geom.end.x);
      const y1 = Math.min(geom.start.y, geom.end.y);
      const y2 = Math.max(geom.start.y, geom.end.y);

      const pts2D = [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ];

      const grid: string[][] = [];
      const steps = isFullRevolve ? segments : segments + 1;

      for (let i = 0; i < steps; i++) {
        const theta = (i * radAngle) / segments;
        const row: string[] = [];
        for (let j = 0; j < 4; j++) {
          const pt = rotatePoint(pts2D[j].x, pts2D[j].y, theta);
          row.push(addVertex(pt.x, pt.y, pt.z, `${geom.id}_${i}_${j}`));
        }
        grid.push(row);
      }

      for (let j = 0; j < 4; j++) {
        const nextJ = (j + 1) % 4;
        for (let i = 0; i < segments; i++) {
          const nextI = (i + 1) % steps;
          const v00 = grid[i][j];
          const v10 = grid[nextI][j];
          const v11 = grid[nextI][nextJ];
          const v01 = grid[i][nextJ];

          const e1 = addEdge('line', v00, v10, `${geom.id}_${j}_${i}_e1`);
          const e2 = addEdge('line', v10, v11, `${geom.id}_${j}_${i}_e2`);
          const e3 = addEdge('line', v11, v01, `${geom.id}_${j}_${i}_e3`);
          const e4 = addEdge('line', v01, v00, `${geom.id}_${j}_${i}_e4`);

          const wireId = `w_rv_face_${geom.id}_${j}_${i}_${featureId}`;
          wires.push({ id: wireId, edgeIds: [e1, e2, e3, e4] });

          const faceId = `f_rv_face_${geom.id}_${j}_${i}_${featureId}`;
          const v00_obj = vertices.find((v) => v.id === v00)!;
          const v10_obj = vertices.find((v) => v.id === v10)!;
          const v01_obj = vertices.find((v) => v.id === v01)!;
          const ux = v10_obj.x - v00_obj.x;
          const uy = v10_obj.y - v00_obj.y;
          const uz = v10_obj.z - v00_obj.z;
          const vx = v01_obj.x - v00_obj.x;
          const vy = v01_obj.y - v00_obj.y;
          const vz = v01_obj.z - v00_obj.z;
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

          faces.push({
            id: faceId,
            outerWireId: wireId,
            innerWireIds: [],
            normal: { x: nx / len, y: ny / len, z: nz / len },
          });
          shellFaceIds.push(faceId);
        }
      }

      if (!isFullRevolve) {
        const startWireId = `w_rv_start_${geom.id}_${featureId}`;
        const se1 = addEdge('line', grid[0][0], grid[0][1], `${geom.id}_se1`);
        const se2 = addEdge('line', grid[0][1], grid[0][2], `${geom.id}_se2`);
        const se3 = addEdge('line', grid[0][2], grid[0][3], `${geom.id}_se3`);
        const se4 = addEdge('line', grid[0][3], grid[0][0], `${geom.id}_se4`);
        wires.push({ id: startWireId, edgeIds: [se1, se2, se3, se4] });

        const startFaceId = `f_rv_start_${geom.id}_${featureId}`;
        faces.push({
          id: startFaceId,
          outerWireId: startWireId,
          innerWireIds: [],
          normal: { x: 0, y: 0, z: -1 },
        });
        shellFaceIds.push(startFaceId);

        const last = grid.length - 1;
        const endWireId = `w_rv_end_${geom.id}_${featureId}`;
        const ee1 = addEdge('line', grid[last][0], grid[last][1], `${geom.id}_ee1`);
        const ee2 = addEdge('line', grid[last][1], grid[last][2], `${geom.id}_ee2`);
        const ee3 = addEdge('line', grid[last][2], grid[last][3], `${geom.id}_ee3`);
        const ee4 = addEdge('line', grid[last][3], grid[last][0], `${geom.id}_ee4`);
        wires.push({ id: endWireId, edgeIds: [ee1, ee2, ee3, ee4] });

        const endFaceId = `f_rv_end_${geom.id}_${featureId}`;
        faces.push({
          id: endFaceId,
          outerWireId: endWireId,
          innerWireIds: [],
          normal: { x: 0, y: 0, z: 1 },
        });
        shellFaceIds.push(endFaceId);
      }
    } else if (geom.type === 'circle') {
      const cx = geom.center.x;
      const cy = geom.center.y;
      const r = geom.radius;

      const circlePts: { x: number; y: number }[] = [];
      const numCircleSegments = 16;
      for (let j = 0; j < numCircleSegments; j++) {
        const phi = (j * Math.PI * 2) / numCircleSegments;
        circlePts.push({
          x: cx + r * Math.cos(phi),
          y: cy + r * Math.sin(phi),
        });
      }

      const grid: string[][] = [];
      const steps = isFullRevolve ? segments : segments + 1;

      for (let i = 0; i < steps; i++) {
        const theta = (i * radAngle) / segments;
        const row: string[] = [];
        for (let j = 0; j < numCircleSegments; j++) {
          const pt = rotatePoint(circlePts[j].x, circlePts[j].y, theta);
          row.push(addVertex(pt.x, pt.y, pt.z, `${geom.id}_${i}_${j}`));
        }
        grid.push(row);
      }

      for (let j = 0; j < numCircleSegments; j++) {
        const nextJ = (j + 1) % numCircleSegments;
        for (let i = 0; i < segments; i++) {
          const nextI = (i + 1) % steps;
          const v00 = grid[i][j];
          const v10 = grid[nextI][j];
          const v11 = grid[nextI][nextJ];
          const v01 = grid[i][nextJ];

          const e1 = addEdge('line', v00, v10, `${geom.id}_${j}_${i}_e1`);
          const e2 = addEdge('line', v10, v11, `${geom.id}_${j}_${i}_e2`);
          const e3 = addEdge('line', v11, v01, `${geom.id}_${j}_${i}_e3`);
          const e4 = addEdge('line', v01, v00, `${geom.id}_${j}_${i}_e4`);

          const wireId = `w_rv_circ_${geom.id}_${j}_${i}_${featureId}`;
          wires.push({ id: wireId, edgeIds: [e1, e2, e3, e4] });

          const faceId = `f_rv_circ_${geom.id}_${j}_${i}_${featureId}`;
          const v00_obj = vertices.find((v) => v.id === v00)!;
          const v10_obj = vertices.find((v) => v.id === v10)!;
          const v01_obj = vertices.find((v) => v.id === v01)!;
          const ux = v10_obj.x - v00_obj.x;
          const uy = v10_obj.y - v00_obj.y;
          const uz = v10_obj.z - v00_obj.z;
          const vx = v01_obj.x - v00_obj.x;
          const vy = v01_obj.y - v00_obj.y;
          const vz = v01_obj.z - v00_obj.z;
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

          faces.push({
            id: faceId,
            outerWireId: wireId,
            innerWireIds: [],
            normal: { x: nx / len, y: ny / len, z: nz / len },
          });
          shellFaceIds.push(faceId);
        }
      }
    }
  }

  if (shellFaceIds.length > 0) {
    const shellId = `shell_${featureId}`;
    shells.push({ id: shellId, faceIds: shellFaceIds });
    const solidId = `solid_${featureId}`;
    solids.push({ id: solidId, shellId });
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Mock groove operation that subtracts a revolved 2D profile from a base solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param profile Wires/shapes from sketch.
 * @param angle Rotation angle in degrees (0 to 360).
 * @param axis Rotation axis ('X' | 'Y').
 * @returns Modified B-Rep shape.
 */
export function grooveProfile(
  baseSolid: BrepShape,
  profile: SketchGeometry[],
  angle: number = 360,
  axis: 'X' | 'Y' = 'Y',
): BrepShape {
  const radAngle = (angle * Math.PI) / 180;

  const vertices = baseSolid.vertices.map((v) => {
    const r = axis === 'Y' ? Math.sqrt(v.x * v.x + v.z * v.z) : Math.sqrt(v.y * v.y + v.z * v.z);
    let theta = axis === 'Y' ? Math.atan2(v.z, v.x) : Math.atan2(v.z, v.y);
    if (theta < 0) theta += Math.PI * 2;
    const checkX = axis === 'Y' ? r : v.x;
    const checkY = axis === 'Y' ? v.y : r;

    const inAngleRange = theta <= radAngle || Math.abs(theta - radAngle) < 0.01;
    if (!inAngleRange) return v;

    for (const geom of profile) {
      if (geom.type === 'rect') {
        const x1 = Math.min(geom.start.x, geom.end.x);
        const x2 = Math.max(geom.start.x, geom.end.x);
        const y1 = Math.min(geom.start.y, geom.end.y);
        const y2 = Math.max(geom.start.y, geom.end.y);

        if (checkX >= x1 && checkX <= x2 && checkY >= y1 && checkY <= y2) {
          if (axis === 'Y') {
            const scale = r > 0 ? x1 / r : 0;
            return { ...v, x: v.x * scale, z: v.z * scale };
          } else {
            const scale = r > 0 ? y1 / r : 0;
            return { ...v, y: v.y * scale, z: v.z * scale };
          }
        }
      } else if (geom.type === 'circle') {
        const dx = checkX - geom.center.x;
        const dy = checkY - geom.center.y;
        if (dx * dx + dy * dy <= geom.radius * geom.radius) {
          const distToCenter = Math.sqrt(dx * dx + dy * dy);
          const pushX = geom.center.x - (geom.radius * dx) / (distToCenter || 1);
          if (axis === 'Y') {
            const newR = pushX;
            const scale = r > 0 ? newR / r : 0;
            return { ...v, x: v.x * scale, z: v.z * scale };
          } else {
            const newR = pushX;
            const scale = r > 0 ? newR / r : 0;
            return { ...v, y: v.y * scale, z: v.z * scale };
          }
        }
      }
    }
    return v;
  });

  return {
    ...baseSolid,
    vertices,
  };
}

/**
 * Builds a B-Rep solid shape by lofting between multiple sketch profiles at different Z levels.
 * @param profiles List of profiles with their respective Z heights.
 * @returns B-Rep solid shape.
 */
export function loftProfiles(
  profiles: { geometries: SketchGeometry[]; z: number }[],
  featureId: string = 'loft',
): BrepShape {
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];
  const wires: Wire3D[] = [];
  const faces: Face3D[] = [];
  const shells: Shell3D[] = [];
  const solids: Solid3D[] = [];

  if (profiles.length < 2) return { vertices, edges, wires, faces, shells, solids };

  const shellFaceIds: string[] = [];
  const M = 32;
  const grid: string[][] = [];

  const addVertex = (x: number, y: number, z: number): string => {
    const id = `lv_${vertices.length}_${featureId}`;
    vertices.push({ id, x, y, z });
    return id;
  };

  const addEdge = (type: 'line' | 'arc' | 'circle', startId: string, endId: string): string => {
    const id = `le_${edges.length}_${featureId}`;
    edges.push({ id, type, startVertexId: startId, endVertexId: endId });
    return id;
  };

  for (const prof of profiles) {
    const pts2D = sampleProfileToPoints(prof.geometries, M);
    if (pts2D.length === 0) continue;

    const row: string[] = [];
    for (const pt of pts2D) {
      row.push(addVertex(pt.x, pt.y, prof.z));
    }
    grid.push(row);
  }

  if (grid.length < 2) return { vertices, edges, wires, faces, shells, solids };

  for (let i = 0; i < grid.length - 1; i++) {
    const rowCurrent = grid[i];
    const rowNext = grid[i + 1];

    for (let j = 0; j < M; j++) {
      const nextJ = (j + 1) % M;
      const v00 = rowCurrent[j];
      const v10 = rowCurrent[nextJ];
      const v11 = rowNext[nextJ];
      const v01 = rowNext[j];

      const e1 = addEdge('line', v00, v10);
      const e2 = addEdge('line', v10, v11);
      const e3 = addEdge('line', v11, v01);
      const e4 = addEdge('line', v01, v00);

      const wireId = `w_loft_side_${featureId}_${i}_${j}`;
      wires.push({ id: wireId, edgeIds: [e1, e2, e3, e4] });

      const faceId = `f_loft_side_${featureId}_${i}_${j}`;
      const v00_obj = vertices.find((v) => v.id === v00)!;
      const v10_obj = vertices.find((v) => v.id === v10)!;
      const v01_obj = vertices.find((v) => v.id === v01)!;
      const ux = v10_obj.x - v00_obj.x;
      const uy = v10_obj.y - v00_obj.y;
      const uz = v10_obj.z - v00_obj.z;
      const vx = v01_obj.x - v00_obj.x;
      const vy = v01_obj.y - v00_obj.y;
      const vz = v01_obj.z - v00_obj.z;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      faces.push({
        id: faceId,
        outerWireId: wireId,
        innerWireIds: [],
        normal: { x: nx / len, y: ny / len, z: nz / len },
      });
      shellFaceIds.push(faceId);
    }
  }

  const bottomWireIds: string[] = [];
  for (let j = 0; j < M; j++) {
    bottomWireIds.push(addEdge('line', grid[0][j], grid[0][(j + 1) % M]));
  }
  const bottomWireId = `w_loft_bottom_${featureId}`;
  wires.push({ id: bottomWireId, edgeIds: bottomWireIds });
  const bottomFaceId = `f_loft_bottom_${featureId}`;
  faces.push({
    id: bottomFaceId,
    outerWireId: bottomWireId,
    innerWireIds: [],
    normal: { x: 0, y: 0, z: -1 },
  });
  shellFaceIds.push(bottomFaceId);

  const lastIdx = grid.length - 1;
  const topWireIds: string[] = [];
  for (let j = 0; j < M; j++) {
    topWireIds.push(addEdge('line', grid[lastIdx][j], grid[lastIdx][(j + 1) % M]));
  }
  const topWireId = `w_loft_top_${featureId}`;
  wires.push({ id: topWireId, edgeIds: topWireIds });
  const topFaceId = `f_loft_top_${featureId}`;
  faces.push({
    id: topFaceId,
    outerWireId: topWireId,
    innerWireIds: [],
    normal: { x: 0, y: 0, z: 1 },
  });
  shellFaceIds.push(topFaceId);

  if (shellFaceIds.length > 0) {
    const shellId = `shell_${featureId}`;
    shells.push({ id: shellId, faceIds: shellFaceIds });
    const solidId = `solid_${featureId}`;
    solids.push({ id: solidId, shellId });
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Extracts ordered 3D points forming a path from a trajectory shape.
 * @param trajectoryShape Helical wire or other trajectory B-Rep shape.
 * @returns Ordered 3D points.
 */
export function getTrajectoryPoints(
  trajectoryShape: BrepShape,
): { x: number; y: number; z: number }[] {
  return trajectoryShape.vertices.map((v) => ({ x: v.x, y: v.y, z: v.z }));
}

/**
 * Samples a sketch's linear geometries to form a continuous 3D trajectory.
 * @param profile Sketch geometries.
 * @returns List of 3D trajectory points.
 */
export function getSketchTrajectoryPoints(
  profile: SketchGeometry[],
): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  for (const geom of profile) {
    if (geom.type === 'line') {
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        pts.push({
          x: geom.start.x + t * (geom.end.x - geom.start.x),
          y: geom.start.y + t * (geom.end.y - geom.start.y),
          z: 0,
        });
      }
    }
  }
  return pts;
}

/**
 * Sweeps a 2D profile along a 3D trajectory (list of points).
 * @param profile 2D sketch profile.
 * @param trajectory List of 3D points forming the path.
 * @returns B-Rep solid shape.
 */
export function sweepProfile(
  profile: SketchGeometry[],
  trajectory: { x: number; y: number; z: number }[],
  featureId: string = 'sweep',
): BrepShape {
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];
  const wires: Wire3D[] = [];
  const faces: Face3D[] = [];
  const shells: Shell3D[] = [];
  const solids: Solid3D[] = [];

  if (profile.length === 0 || trajectory.length < 2) {
    return { vertices, edges, wires, faces, shells, solids };
  }

  const shellFaceIds: string[] = [];
  const M = 32;

  const pts2D = sampleProfileToPoints(profile, M);
  if (pts2D.length === 0) return { vertices, edges, wires, faces, shells, solids };

  const frames: {
    origin: { x: number; y: number; z: number };
    u: { x: number; y: number; z: number };
    v: { x: number; y: number; z: number };
  }[] = [];

  const normalize = (vec: { x: number; y: number; z: number }) => {
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z) || 1;
    return { x: vec.x / len, y: vec.y / len, z: vec.z / len };
  };

  const cross = (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ) => {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  };

  const p0 = trajectory[0];
  const p1 = trajectory[1];
  let t0 = normalize({ x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z });

  let initialNormal = { x: 0, y: 1, z: 0 };
  if (Math.abs(t0.y) > 0.9) {
    initialNormal = { x: 1, y: 0, z: 0 };
  }
  const u0 = normalize(cross(initialNormal, t0));
  const v0 = normalize(cross(t0, u0));

  frames.push({ origin: p0, u: u0, v: v0 });

  for (let i = 1; i < trajectory.length; i++) {
    const prevFrame = frames[i - 1];
    const currOrigin = trajectory[i];
    const prevOrigin = prevFrame.origin;

    const currTangent =
      i < trajectory.length - 1
        ? normalize({
            x: trajectory[i + 1].x - currOrigin.x,
            y: trajectory[i + 1].y - currOrigin.y,
            z: trajectory[i + 1].z - currOrigin.z,
          })
        : normalize({
            x: currOrigin.x - prevOrigin.x,
            y: currOrigin.y - prevOrigin.y,
            z: currOrigin.z - prevOrigin.z,
          });

    const v1 = {
      x: currOrigin.x - prevOrigin.x,
      y: currOrigin.y - prevOrigin.y,
      z: currOrigin.z - prevOrigin.z,
    };
    const c1 = v1.x * v1.x + v1.y * v1.y + v1.z * v1.z;
    if (c1 === 0) {
      frames.push({ origin: currOrigin, u: prevFrame.u, v: prevFrame.v });
      continue;
    }

    const dot_u = prevFrame.u.x * v1.x + prevFrame.u.y * v1.y + prevFrame.u.z * v1.z;
    const u_r = {
      x: prevFrame.u.x - (2 / c1) * dot_u * v1.x,
      y: prevFrame.u.y - (2 / c1) * dot_u * v1.y,
      z: prevFrame.u.z - (2 / c1) * dot_u * v1.z,
    };

    const dot_t = t0.x * v1.x + t0.y * v1.y + t0.z * v1.z;
    const t_r = {
      x: t0.x - (2 / c1) * dot_t * v1.x,
      y: t0.y - (2 / c1) * dot_t * v1.y,
      z: t0.z - (2 / c1) * dot_t * v1.z,
    };

    const v2 = { x: currTangent.x - t_r.x, y: currTangent.y - t_r.y, z: currTangent.z - t_r.z };
    const c2 = v2.x * v2.x + v2.y * v2.y + v2.z * v2.z;

    let currU = u_r;
    if (c2 > 0) {
      const dot_ur = u_r.x * v2.x + u_r.y * v2.y + u_r.z * v2.z;
      currU = {
        x: u_r.x - (2 / c2) * dot_ur * v2.x,
        y: u_r.y - (2 / c2) * dot_ur * v2.y,
        z: u_r.z - (2 / c2) * dot_ur * v2.z,
      };
    }

    currU = normalize(currU);
    const currV = normalize(cross(currTangent, currU));

    frames.push({ origin: currOrigin, u: currU, v: currV });
    t0 = currTangent;
  }

  const grid: string[][] = [];

  const addVertex = (x: number, y: number, z: number): string => {
    const id = `sv_${vertices.length}_${featureId}`;
    vertices.push({ id, x, y, z });
    return id;
  };

  const addEdge = (type: 'line' | 'arc' | 'circle', startId: string, endId: string): string => {
    const id = `se_${edges.length}_${featureId}`;
    edges.push({ id, type, startVertexId: startId, endVertexId: endId });
    return id;
  };

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const row: string[] = [];
    for (const pt of pts2D) {
      const x3d = frame.origin.x + pt.x * frame.u.x + pt.y * frame.v.x;
      const y3d = frame.origin.y + pt.x * frame.u.y + pt.y * frame.v.y;
      const z3d = frame.origin.z + pt.x * frame.u.z + pt.y * frame.v.z;
      row.push(addVertex(x3d, y3d, z3d));
    }
    grid.push(row);
  }

  for (let i = 0; i < grid.length - 1; i++) {
    const rowCurrent = grid[i];
    const rowNext = grid[i + 1];

    for (let j = 0; j < M; j++) {
      const nextJ = (j + 1) % M;
      const v00 = rowCurrent[j];
      const v10 = rowCurrent[nextJ];
      const v11 = rowNext[nextJ];
      const v01 = rowNext[j];

      const e1 = addEdge('line', v00, v10);
      const e2 = addEdge('line', v10, v11);
      const e3 = addEdge('line', v11, v01);
      const e4 = addEdge('line', v01, v00);

      const wireId = `w_sweep_side_${featureId}_${i}_${j}`;
      wires.push({ id: wireId, edgeIds: [e1, e2, e3, e4] });

      const faceId = `f_sweep_side_${featureId}_${i}_${j}`;
      const v00_obj = vertices.find((v) => v.id === v00)!;
      const v10_obj = vertices.find((v) => v.id === v10)!;
      const v01_obj = vertices.find((v) => v.id === v01)!;
      const ux = v10_obj.x - v00_obj.x;
      const uy = v10_obj.y - v00_obj.y;
      const uz = v10_obj.z - v00_obj.z;
      const vx = v01_obj.x - v00_obj.x;
      const vy = v01_obj.y - v00_obj.y;
      const vz = v01_obj.z - v00_obj.z;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      faces.push({
        id: faceId,
        outerWireId: wireId,
        innerWireIds: [],
        normal: { x: nx / len, y: ny / len, z: nz / len },
      });
      shellFaceIds.push(faceId);
    }
  }

  const bottomWireIds: string[] = [];
  for (let j = 0; j < M; j++) {
    bottomWireIds.push(addEdge('line', grid[0][j], grid[0][(j + 1) % M]));
  }
  const bottomWireId = `w_sweep_bottom_${featureId}`;
  wires.push({ id: bottomWireId, edgeIds: bottomWireIds });
  const bottomFaceId = `f_sweep_bottom_${featureId}`;
  faces.push({
    id: bottomFaceId,
    outerWireId: bottomWireId,
    innerWireIds: [],
    normal: { x: -t0.x, y: -t0.y, z: -t0.z },
  });
  shellFaceIds.push(bottomFaceId);

  const lastIdx = grid.length - 1;
  const topWireIds: string[] = [];
  for (let j = 0; j < M; j++) {
    topWireIds.push(addEdge('line', grid[lastIdx][j], grid[lastIdx][(j + 1) % M]));
  }
  const topWireId = `w_sweep_top_${featureId}`;
  wires.push({ id: topWireId, edgeIds: topWireIds });
  const topFaceId = `f_sweep_top_${featureId}`;
  faces.push({
    id: topFaceId,
    outerWireId: topWireId,
    innerWireIds: [],
    normal: { x: t0.x, y: t0.y, z: t0.z },
  });
  shellFaceIds.push(topFaceId);

  if (shellFaceIds.length > 0) {
    const shellId = `shell_${featureId}`;
    shells.push({ id: shellId, faceIds: shellFaceIds });
    const solidId = `solid_${featureId}`;
    solids.push({ id: solidId, shellId });
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Builds a 3D helical path (B-Rep wire) based on pitch, height, radius, and handedness.
 * @param pitch Pitch of the helix.
 * @param height Total height of the helix.
 * @param radius Radius of the helix.
 * @param handedness Handedness ('right' | 'left').
 * @returns B-Rep wire shape.
 */
export function helixPath(
  pitch: number = 5,
  height: number = 20,
  radius: number = 10,
  handedness: 'right' | 'left' = 'right',
  featureId: string = 'helix',
): BrepShape {
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];

  const addVertex = (x: number, y: number, z: number): string => {
    const id = `hv_${vertices.length}_${featureId}`;
    vertices.push({ id, x, y, z });
    return id;
  };

  const addEdge = (type: 'line' | 'arc' | 'circle', startId: string, endId: string): string => {
    const id = `he_${edges.length}_${featureId}`;
    edges.push({ id, type, startVertexId: startId, endVertexId: endId });
    return id;
  };

  const turns = height / (pitch || 1);
  const totalAngle = turns * Math.PI * 2;
  const segments = Math.max(16, Math.floor(turns * 24));

  let prevVertexId: string | null = null;
  const edgeIds: string[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * totalAngle * (handedness === 'left' ? -1 : 1);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const z = t * height;

    const currentVertexId = addVertex(x, y, z);
    if (prevVertexId) {
      const edgeId = addEdge('line', prevVertexId, currentVertexId);
      edgeIds.push(edgeId);
    }
    prevVertexId = currentVertexId;
  }

  const wires: Wire3D[] = [];
  if (edgeIds.length > 0) {
    wires.push({ id: `wire_helix_${featureId}`, edgeIds });
  }

  return { vertices, edges, wires, faces: [], shells: [], solids: [] };
}

/**
 * Mock fillet operation that rounds the edges of a B-Rep solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param radius Fillet radius.
 * @returns Modified B-Rep shape.
 */
export function filletSolid(baseSolid: BrepShape, radius: number): BrepShape {
  if (baseSolid.vertices.length === 0) return baseSolid;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const v of baseSolid.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const vertices = baseSolid.vertices.map((v) => {
    const dx = v.x - cx;
    const dy = v.y - cy;
    const dz = v.z - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const shrinkFactor = Math.max(0.1, 1 - radius / dist);

    const isCorner =
      (Math.abs(v.x - minX) < 0.1 || Math.abs(v.x - maxX) < 0.1) &&
      (Math.abs(v.y - minY) < 0.1 || Math.abs(v.y - maxY) < 0.1);

    if (isCorner) {
      return {
        ...v,
        x: cx + dx * shrinkFactor,
        y: cy + dy * shrinkFactor,
      };
    }
    return v;
  });

  return {
    ...baseSolid,
    vertices,
  };
}

/**
 * Mock chamfer operation that bevels the edges of a B-Rep solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param distance Chamfer distance.
 * @returns Modified B-Rep shape.
 */
export function chamferSolid(baseSolid: BrepShape, distance: number): BrepShape {
  return filletSolid(baseSolid, distance);
}

/**
 * Mock draft operation that tapers the vertical faces of a B-Rep solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param angle Draft angle in degrees.
 * @returns Modified B-Rep shape.
 */
export function draftSolid(baseSolid: BrepShape, angle: number): BrepShape {
  if (baseSolid.vertices.length === 0) return baseSolid;

  let minZ = Infinity,
    maxZ = -Infinity;
  for (const v of baseSolid.vertices) {
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  const height = maxZ - minZ || 1;
  const radAngle = (angle * Math.PI) / 180;
  const taperRatio = Math.tan(radAngle);

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  for (const v of baseSolid.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const vertices = baseSolid.vertices.map((v) => {
    const zOffset = v.z - minZ;
    const factor = 1 - (zOffset / height) * taperRatio;
    return {
      ...v,
      x: cx + (v.x - cx) * factor,
      y: cy + (v.y - cy) * factor,
    };
  });

  return {
    ...baseSolid,
    vertices,
  };
}

/**
 * Mock thickness operation that hollows out a B-Rep solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param thickness Wall thickness.
 * @returns Modified B-Rep shape.
 */
export function thicknessSolid(baseSolid: BrepShape, thickness: number): BrepShape {
  if (baseSolid.vertices.length === 0) return baseSolid;

  const maxZ = Math.max(...baseSolid.vertices.map((v) => v.z));

  const xs = baseSolid.vertices.map((v) => v.x);
  const ys = baseSolid.vertices.map((v) => v.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const vertices: Vertex3D[] = [...baseSolid.vertices];
  const edges: Edge3D[] = [...baseSolid.edges];
  const wires: Wire3D[] = [...baseSolid.wires];
  const faces: Face3D[] = [...baseSolid.faces];

  const innerVertexMap = new Map<string, string>();
  for (const v of baseSolid.vertices) {
    const isTop = Math.abs(v.z - maxZ) < 0.1;
    const dx = v.x - cx;
    const dy = v.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const scale = Math.max(0.1, 1 - thickness / dist);

    const newZ = isTop ? v.z : Math.min(v.z + thickness, maxZ - 0.1);
    const newX = cx + dx * scale;
    const newY = cy + dy * scale;

    const id = `iv_${v.id}_${Date.now()}`;
    vertices.push({ id, x: newX, y: newY, z: newZ });
    innerVertexMap.set(v.id, id);
  }

  for (const f of baseSolid.faces) {
    if (f.id.includes('top')) {
      continue;
    }
    const wire = baseSolid.wires.find((w) => w.id === f.outerWireId);
    if (!wire) continue;

    const innerEdgeIds: string[] = [];
    for (const edgeId of wire.edgeIds) {
      const edge = baseSolid.edges.find((e) => e.id === edgeId);
      if (!edge) continue;
      const vStart = edge.startVertexId;
      const vEnd = edge.endVertexId;
      const ivStart = innerVertexMap.get(vStart)!;
      const ivEnd = innerVertexMap.get(vEnd)!;

      const newEdgeId = `ie_${edge.id}_${Date.now()}`;
      edges.push({
        id: newEdgeId,
        type: edge.type,
        startVertexId: ivStart,
        endVertexId: ivEnd,
        center: edge.center,
        radius: edge.radius ? edge.radius - thickness : undefined,
      });
      innerEdgeIds.push(newEdgeId);
    }

    const innerWireId = `iw_${wire.id}_${Date.now()}`;
    wires.push({ id: innerWireId, edgeIds: innerEdgeIds });

    const innerFaceId = `if_${f.id}_${Date.now()}`;
    faces.push({
      id: innerFaceId,
      outerWireId: innerWireId,
      innerWireIds: [],
      normal: { x: -f.normal.x, y: -f.normal.y, z: -f.normal.z },
    });
  }

  return {
    vertices,
    edges,
    wires,
    faces,
    shells: baseSolid.shells,
    solids: baseSolid.solids,
  };
}

/**
 * Mock hole operation that cuts standard engineering holes into a B-Rep solid.
 * @param baseSolid Base solid B-Rep shape.
 * @param points List of 2D coordinates for holes.
 * @param holeType Type of hole ('simple' | 'counterbore' | 'countersink' | 'tapped').
 * @param size Standard size (diameter in mm).
 * @param depth Depth of the hole.
 * @returns Modified B-Rep shape.
 */
export function holeSolid(
  baseSolid: BrepShape,
  points: { x: number; y: number }[],
  holeType: 'simple' | 'counterbore' | 'countersink' | 'tapped' = 'simple',
  size: number = 4,
  depth: number = 10,
): BrepShape {
  if (baseSolid.vertices.length === 0 || points.length === 0) return baseSolid;

  const r = size / 2;
  const vertices = baseSolid.vertices.map((v) => {
    for (const pt of points) {
      const dx = v.x - pt.x;
      const dy = v.y - pt.y;
      if (dx * dx + dy * dy <= r * r) {
        let actualDepth = depth;
        if (holeType === 'counterbore' && dx * dx + dy * dy <= r * 1.5 * (r * 1.5)) {
          actualDepth = Math.max(depth, 3);
        }
        return { ...v, z: Math.max(0, v.z - actualDepth) };
      }
    }
    return v;
  });

  return {
    ...baseSolid,
    vertices,
  };
}

/**
 * Performs boolean union on two shapes.
 * @param shapeA First shape.
 * @param shapeB Second shape.
 * @returns Unioned shape.
 */
export function unionSolids(shapeA: BrepShape, shapeB: BrepShape): BrepShape {
  return {
    vertices: [...shapeA.vertices, ...shapeB.vertices],
    edges: [...shapeA.edges, ...shapeB.edges],
    wires: [...shapeA.wires, ...shapeB.wires],
    faces: [...shapeA.faces, ...shapeB.faces],
    shells: [...shapeA.shells, ...shapeB.shells],
    solids: [...shapeA.solids, ...shapeB.solids],
  };
}

/**
 * Subtracts shape B from shape A.
 * @param shapeA Target shape.
 * @param shapeB Tool shape.
 * @returns Resulting shape.
 */
export function differenceSolids(shapeA: BrepShape, shapeB: BrepShape): BrepShape {
  if (shapeB.vertices.length === 0) return shapeA;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const v of shapeB.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }

  const vertices = shapeA.vertices.map((v) => {
    if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY && v.z >= minZ && v.z <= maxZ) {
      return { ...v, z: Math.max(0, minZ) };
    }
    return v;
  });

  return {
    ...shapeA,
    vertices,
  };
}

/**
 * Keeps only the intersecting volume.
 * @param shapeA First shape.
 * @param shapeB Second shape.
 * @returns Intersection shape.
 */
export function intersectionSolids(shapeA: BrepShape, shapeB: BrepShape): BrepShape {
  if (shapeA.vertices.length === 0 || shapeB.vertices.length === 0) {
    return { vertices: [], edges: [], wires: [], faces: [], shells: [], solids: [] };
  }

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const v of shapeB.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }

  const vertices = shapeA.vertices.filter((v) => {
    return v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY && v.z >= minZ && v.z <= maxZ;
  });

  const validVertexIds = new Set(vertices.map((v) => v.id));
  const edges = shapeA.edges.filter(
    (e) => validVertexIds.has(e.startVertexId) && validVertexIds.has(e.endVertexId),
  );
  const validEdgeIds = new Set(edges.map((e) => e.id));
  const wires = shapeA.wires
    .map((w) => ({
      ...w,
      edgeIds: w.edgeIds.filter((eid) => validEdgeIds.has(eid)),
    }))
    .filter((w) => w.edgeIds.length > 0);
  const validWireIds = new Set(wires.map((w) => w.id));
  const faces = shapeA.faces.filter((f) => validWireIds.has(f.outerWireId));

  return {
    vertices,
    edges,
    wires,
    faces,
    shells: shapeA.shells,
    solids: shapeA.solids,
  };
}

/**
 * Duplicates a B-Rep shape in a linear pattern.
 * @param baseSolid Base solid B-Rep shape.
 * @param count Number of instances (including original).
 * @param spacing Distance between instances.
 * @param direction Direction of the pattern ('X' | 'Y' | 'Z').
 * @returns Combined B-Rep shape.
 */
export function linearPatternSolid(
  baseSolid: BrepShape,
  count: number = 2,
  spacing: number = 15,
  direction: 'X' | 'Y' | 'Z' = 'X',
  featureId: string = 'lp',
): BrepShape {
  if (baseSolid.vertices.length === 0 || count <= 1) return baseSolid;

  const vertices = [...baseSolid.vertices];
  const edges = [...baseSolid.edges];
  const wires = [...baseSolid.wires];
  const faces = [...baseSolid.faces];
  const shells = [...baseSolid.shells];
  const solids = [...baseSolid.solids];

  const originalVertexCount = baseSolid.vertices.length;
  const originalEdgeCount = baseSolid.edges.length;
  const originalWireCount = baseSolid.wires.length;
  const originalFaceCount = baseSolid.faces.length;

  for (let i = 1; i < count; i++) {
    const shift = i * spacing;
    const vertexMap = new Map<string, string>();

    for (let vIdx = 0; vIdx < originalVertexCount; vIdx++) {
      const v = baseSolid.vertices[vIdx];
      const newId = `lp_v_${featureId}_${i}_${vIdx}`;
      vertexMap.set(v.id, newId);
      vertices.push({
        id: newId,
        x: v.x + (direction === 'X' ? shift : 0),
        y: v.y + (direction === 'Y' ? shift : 0),
        z: v.z + (direction === 'Z' ? shift : 0),
      });
    }

    const edgeMap = new Map<string, string>();
    for (let eIdx = 0; eIdx < originalEdgeCount; eIdx++) {
      const e = baseSolid.edges[eIdx];
      const newId = `lp_e_${featureId}_${i}_${eIdx}`;
      edgeMap.set(e.id, newId);
      edges.push({
        id: newId,
        type: e.type,
        startVertexId: vertexMap.get(e.startVertexId)!,
        endVertexId: vertexMap.get(e.endVertexId)!,
        center: e.center
          ? {
              x: e.center.x + (direction === 'X' ? shift : 0),
              y: e.center.y + (direction === 'Y' ? shift : 0),
              z: e.center.z + (direction === 'Z' ? shift : 0),
            }
          : undefined,
        radius: e.radius,
      });
    }

    const wireMap = new Map<string, string>();
    for (let wIdx = 0; wIdx < originalWireCount; wIdx++) {
      const w = baseSolid.wires[wIdx];
      const newId = `lp_w_${featureId}_${i}_${wIdx}`;
      wireMap.set(w.id, newId);
      wires.push({
        id: newId,
        edgeIds: w.edgeIds.map((eid) => edgeMap.get(eid)!),
      });
    }

    for (let fIdx = 0; fIdx < originalFaceCount; fIdx++) {
      const f = baseSolid.faces[fIdx];
      const newId = `lp_f_${featureId}_${i}_${fIdx}`;
      faces.push({
        id: newId,
        outerWireId: wireMap.get(f.outerWireId)!,
        innerWireIds: f.innerWireIds.map((iwid) => wireMap.get(iwid)!),
        normal: { ...f.normal },
      });
    }
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Duplicates a B-Rep shape in a polar (circular) pattern.
 * @param baseSolid Base solid B-Rep shape.
 * @param count Number of instances (including original).
 * @param totalAngle Total angle in degrees.
 * @param axis Rotation axis ('X' | 'Y' | 'Z').
 * @returns Combined B-Rep shape.
 */
export function polarPatternSolid(
  baseSolid: BrepShape,
  count: number = 4,
  totalAngle: number = 360,
  axis: 'X' | 'Y' | 'Z' = 'Z',
  featureId: string = 'pp',
): BrepShape {
  if (baseSolid.vertices.length === 0 || count <= 1) return baseSolid;

  const vertices = [...baseSolid.vertices];
  const edges = [...baseSolid.edges];
  const wires = [...baseSolid.wires];
  const faces = [...baseSolid.faces];
  const shells = [...baseSolid.shells];
  const solids = [...baseSolid.solids];

  const originalVertexCount = baseSolid.vertices.length;
  const originalEdgeCount = baseSolid.edges.length;
  const originalWireCount = baseSolid.wires.length;
  const originalFaceCount = baseSolid.faces.length;

  const radStep = (totalAngle * Math.PI) / (180 * count);

  for (let i = 1; i < count; i++) {
    const theta = i * radStep;
    const vertexMap = new Map<string, string>();

    const rotate = (x: number, y: number, z: number) => {
      if (axis === 'Z') {
        return {
          x: x * Math.cos(theta) - y * Math.sin(theta),
          y: x * Math.sin(theta) + y * Math.cos(theta),
          z,
        };
      } else if (axis === 'Y') {
        return {
          x: x * Math.cos(theta) + z * Math.sin(theta),
          y,
          z: -x * Math.sin(theta) + z * Math.cos(theta),
        };
      } else {
        return {
          x,
          y: y * Math.cos(theta) - z * Math.sin(theta),
          z: y * Math.sin(theta) + z * Math.cos(theta),
        };
      }
    };

    for (let vIdx = 0; vIdx < originalVertexCount; vIdx++) {
      const v = baseSolid.vertices[vIdx];
      const newId = `pp_v_${featureId}_${i}_${vIdx}`;
      vertexMap.set(v.id, newId);
      const rot = rotate(v.x, v.y, v.z);
      vertices.push({ id: newId, ...rot });
    }

    const edgeMap = new Map<string, string>();
    for (let eIdx = 0; eIdx < originalEdgeCount; eIdx++) {
      const e = baseSolid.edges[eIdx];
      const newId = `pp_e_${featureId}_${i}_${eIdx}`;
      edgeMap.set(e.id, newId);
      const rotStart = rotate(e.center?.x || 0, e.center?.y || 0, e.center?.z || 0);
      edges.push({
        id: newId,
        type: e.type,
        startVertexId: vertexMap.get(e.startVertexId)!,
        endVertexId: vertexMap.get(e.endVertexId)!,
        center: e.center ? rotStart : undefined,
        radius: e.radius,
      });
    }

    const wireMap = new Map<string, string>();
    for (let wIdx = 0; wIdx < originalWireCount; wIdx++) {
      const w = baseSolid.wires[wIdx];
      const newId = `pp_w_${featureId}_${i}_${wIdx}`;
      wireMap.set(w.id, newId);
      wires.push({
        id: newId,
        edgeIds: w.edgeIds.map((eid) => edgeMap.get(eid)!),
      });
    }

    for (let fIdx = 0; fIdx < originalFaceCount; fIdx++) {
      const f = baseSolid.faces[fIdx];
      const newId = `pp_f_${featureId}_${i}_${fIdx}`;
      const rotNormal = rotate(f.normal.x, f.normal.y, f.normal.z);
      faces.push({
        id: newId,
        outerWireId: wireMap.get(f.outerWireId)!,
        innerWireIds: f.innerWireIds.map((iwid) => wireMap.get(iwid)!),
        normal: rotNormal,
      });
    }
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Mirrors a B-Rep shape across a coordinate plane.
 * @param baseSolid Base solid B-Rep shape.
 * @param plane Mirror plane ('XY' | 'XZ' | 'YZ').
 * @returns Combined B-Rep shape containing original and mirrored solids.
 */
export function mirrorSolid(
  baseSolid: BrepShape,
  plane: 'XY' | 'XZ' | 'YZ' = 'YZ',
  featureId: string = 'mirror',
): BrepShape {
  if (baseSolid.vertices.length === 0) return baseSolid;

  const vertices = [...baseSolid.vertices];
  const edges = [...baseSolid.edges];
  const wires = [...baseSolid.wires];
  const faces = [...baseSolid.faces];
  const shells = [...baseSolid.shells];
  const solids = [...baseSolid.solids];

  const originalVertexCount = baseSolid.vertices.length;
  const originalEdgeCount = baseSolid.edges.length;
  const originalWireCount = baseSolid.wires.length;
  const originalFaceCount = baseSolid.faces.length;

  const reflect = (x: number, y: number, z: number) => {
    return {
      x: plane === 'YZ' ? -x : x,
      y: plane === 'XZ' ? -y : y,
      z: plane === 'XY' ? -z : z,
    };
  };

  const vertexMap = new Map<string, string>();

  for (let vIdx = 0; vIdx < originalVertexCount; vIdx++) {
    const v = baseSolid.vertices[vIdx];
    const newId = `m_v_${featureId}_${vIdx}`;
    vertexMap.set(v.id, newId);
    const ref = reflect(v.x, v.y, v.z);
    vertices.push({ id: newId, ...ref });
  }

  const edgeMap = new Map<string, string>();
  for (let eIdx = 0; eIdx < originalEdgeCount; eIdx++) {
    const e = baseSolid.edges[eIdx];
    const newId = `m_e_${featureId}_${eIdx}`;
    edgeMap.set(e.id, newId);
    const refCenter = reflect(e.center?.x || 0, e.center?.y || 0, e.center?.z || 0);
    edges.push({
      id: newId,
      type: e.type,
      startVertexId: vertexMap.get(e.startVertexId)!,
      endVertexId: vertexMap.get(e.endVertexId)!,
      center: e.center ? refCenter : undefined,
      radius: e.radius,
    });
  }

  const wireMap = new Map<string, string>();
  for (let wIdx = 0; wIdx < originalWireCount; wIdx++) {
    const w = baseSolid.wires[wIdx];
    const newId = `m_w_${featureId}_${wIdx}`;
    wireMap.set(w.id, newId);
    wires.push({
      id: newId,
      edgeIds: w.edgeIds.map((eid) => edgeMap.get(eid)!),
    });
  }

  for (let fIdx = 0; fIdx < originalFaceCount; fIdx++) {
    const f = baseSolid.faces[fIdx];
    const newId = `m_f_${featureId}_${fIdx}`;
    const refNormal = reflect(f.normal.x, f.normal.y, f.normal.z);
    faces.push({
      id: newId,
      outerWireId: wireMap.get(f.outerWireId)!,
      innerWireIds: f.innerWireIds.map((iwid) => wireMap.get(iwid)!),
      normal: refNormal,
    });
  }

  return { vertices, edges, wires, faces, shells, solids };
}

/**
 * Evaluates the CAD features list chronologically to reconstruct the B-Rep shape solid.
 * @param features Parametric features list.
 * @returns Reconstructed B-Rep shape.
 */
export function buildSolidFromFeatures(features: Feature[]): BrepShape {
  const isFeatureVisible = (f: Feature): boolean => {
    let current: Feature | undefined = f;
    while (current) {
      if (current.params.visible === false) {
        return false;
      }
      if (current.parentId) {
        current = features.find((x) => x.id === current!.parentId);
      } else {
        break;
      }
    }
    return true;
  };

  const visibleFeatures = features.filter(isFeatureVisible);
  let solid: BrepShape = { vertices: [], edges: [], wires: [], faces: [], shells: [], solids: [] };
  let currentSketchGeoms: SketchGeometry[] = [];
  const sketchesMap = new Map<string, SketchGeometry[]>();
  const sketchZOffsetMap = new Map<string, number>();
  const shapesMap = new Map<string, BrepShape>();

  let activeSupportPlaneId: string | undefined = undefined;
  for (const f of visibleFeatures) {
    if (f.params.isDatum === true) continue;
    if (f.type === 'sketch') {
      const geoms = (f.params.geometries as SketchGeometry[]) || [];
      sketchesMap.set(f.id, geoms);
      const zOffset = (f.params.zOffset as number) ?? 0;
      sketchZOffsetMap.set(f.id, zOffset);
      currentSketchGeoms = geoms;
      activeSupportPlaneId = f.params.supportPlaneId as string | undefined;
    } else if (f.type === 'pad') {
      const distanceVal = (f.params.distance as number) ?? 10;
      solid = extrudeProfile(currentSketchGeoms, distanceVal, f.id, activeSupportPlaneId);
      shapesMap.set(f.id, solid);
    } else if (f.type === 'pocket') {
      const distanceVal = (f.params.distance as number) ?? 5;
      if (solid.vertices.length > 0) {
        solid = pocketProfile(solid, currentSketchGeoms, distanceVal, f.id, activeSupportPlaneId);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'revolution') {
      const angleVal = (f.params.angle as number) ?? 360;
      const axisVal = (f.params.axis as 'X' | 'Y') ?? 'Y';
      solid = revolveProfile(currentSketchGeoms, angleVal, axisVal, f.id);
      shapesMap.set(f.id, solid);
    } else if (f.type === 'groove') {
      const angleVal = (f.params.angle as number) ?? 360;
      const axisVal = (f.params.axis as 'X' | 'Y') ?? 'Y';
      if (solid.vertices.length > 0) {
        solid = grooveProfile(solid, currentSketchGeoms, angleVal, axisVal);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'loft') {
      const sketchesVal = (f.params.sketches as string[]) || [];
      const profiles = sketchesVal.map((id) => ({
        geometries: sketchesMap.get(id) || [],
        z: sketchZOffsetMap.get(id) || 0,
      }));
      if (profiles.length >= 2) {
        solid = loftProfiles(profiles, f.id);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'pipe') {
      const profileSketchId = f.params.profileSketchId as string;
      const trajectorySketchId = f.params.trajectorySketchId as string;
      const trajectoryHelixId = f.params.trajectoryHelixId as string;
      const prof = sketchesMap.get(profileSketchId) || [];

      let trajPts: { x: number; y: number; z: number }[] = [];
      if (trajectoryHelixId) {
        const helixShape = shapesMap.get(trajectoryHelixId);
        if (helixShape) {
          trajPts = getTrajectoryPoints(helixShape);
        }
      } else if (trajectorySketchId) {
        trajPts = getSketchTrajectoryPoints(sketchesMap.get(trajectorySketchId) || []);
      }

      if (prof.length > 0 && trajPts.length >= 2) {
        solid = sweepProfile(prof, trajPts, f.id);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'helix') {
      const pitchVal = (f.params.pitch as number) ?? 5;
      const heightVal = (f.params.height as number) ?? 20;
      const radiusVal = (f.params.radius as number) ?? 10;
      const handednessVal = (f.params.handedness as 'right' | 'left') ?? 'right';
      solid = helixPath(pitchVal, heightVal, radiusVal, handednessVal, f.id);
      shapesMap.set(f.id, solid);
    } else if (f.type === 'fillet') {
      const radiusVal = (f.params.radius as number) ?? 2;
      if (solid.vertices.length > 0) {
        solid = filletSolid(solid, radiusVal);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'chamfer') {
      const distanceVal = (f.params.distance as number) ?? 2;
      if (solid.vertices.length > 0) {
        solid = chamferSolid(solid, distanceVal);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'draft') {
      const angleVal = (f.params.angle as number) ?? 5;
      if (solid.vertices.length > 0) {
        solid = draftSolid(solid, angleVal);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'thickness') {
      const thicknessVal = (f.params.thickness as number) ?? 2;
      if (solid.vertices.length > 0) {
        solid = thicknessSolid(solid, thicknessVal);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'hole') {
      const holeTypeVal =
        (f.params.holeType as 'simple' | 'counterbore' | 'countersink' | 'tapped') ?? 'simple';
      const sizeVal = (f.params.size as number) ?? 4;
      const depthVal = (f.params.depth as number) ?? 10;

      let pts = currentSketchGeoms.filter((g) => g.type === 'circle').map((g) => g.center);
      if (pts.length === 0) {
        pts = currentSketchGeoms.filter((g) => g.type === 'line').map((g) => g.start);
      }
      if (pts.length === 0) {
        pts = [{ x: 0, y: 0 }];
      }

      if (solid.vertices.length > 0) {
        solid = holeSolid(solid, pts, holeTypeVal, sizeVal, depthVal);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'linear_pattern') {
      const countVal = (f.params.count as number) ?? 2;
      const spacingVal = (f.params.spacing as number) ?? 15;
      const directionVal = (f.params.direction as 'X' | 'Y' | 'Z') ?? 'X';
      if (solid.vertices.length > 0) {
        solid = linearPatternSolid(solid, countVal, spacingVal, directionVal, f.id);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'polar_pattern') {
      const countVal = (f.params.count as number) ?? 4;
      const totalAngleVal = (f.params.totalAngle as number) ?? 360;
      const axisVal = (f.params.axis as 'X' | 'Y' | 'Z') ?? 'Z';
      if (solid.vertices.length > 0) {
        solid = polarPatternSolid(solid, countVal, totalAngleVal, axisVal, f.id);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'mirror') {
      const planeVal = (f.params.plane as 'XY' | 'XZ' | 'YZ') ?? 'YZ';
      if (solid.vertices.length > 0) {
        solid = mirrorSolid(solid, planeVal, f.id);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'union') {
      const featureAId = f.params.featureAId as string;
      const featureBId = f.params.featureBId as string;
      const shapeA = shapesMap.get(featureAId);
      const shapeB = shapesMap.get(featureBId);
      if (shapeA && shapeB) {
        solid = unionSolids(shapeA, shapeB);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'difference') {
      const featureAId = f.params.featureAId as string;
      const featureBId = f.params.featureBId as string;
      const shapeA = shapesMap.get(featureAId);
      const shapeB = shapesMap.get(featureBId);
      if (shapeA && shapeB) {
        solid = differenceSolids(shapeA, shapeB);
      }
      shapesMap.set(f.id, solid);
    } else if (f.type === 'intersection') {
      const featureAId = f.params.featureAId as string;
      const featureBId = f.params.featureBId as string;
      const shapeA = shapesMap.get(featureAId);
      const shapeB = shapesMap.get(featureBId);
      if (shapeA && shapeB) {
        solid = intersectionSolids(shapeA, shapeB);
      }
      shapesMap.set(f.id, solid);
    }
  }

  return solid;
}
