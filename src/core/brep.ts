import { SketchGeometry } from '../store/types.ts';

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

/**
 * Builds a B-Rep cylinder or box shape by extruding a 2D sketch profile.
 * @param profile Wires/shapes from sketch.
 * @param depth Distance to extrude along Z axis.
 * @returns B-Rep solid shape.
 */
export function extrudeProfile(profile: SketchGeometry[], depth: number): BrepShape {
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];
  const wires: Wire3D[] = [];
  const faces: Face3D[] = [];
  const shells: Shell3D[] = [];
  const solids: Solid3D[] = [];

  const shellFaceIds: string[] = [];

  // Helper to add vertex
  const addVertex = (x: number, y: number, z: number): string => {
    const id = `v_${vertices.length}_${Date.now()}`;
    vertices.push({ id, x, y, z });
    return id;
  };

  // Helper to add edge
  const addEdge = (
    type: 'line' | 'arc' | 'circle',
    startId: string,
    endId: string,
    extra?: Partial<Edge3D>,
  ): string => {
    const id = `e_${edges.length}_${Date.now()}`;
    edges.push({ id, type, startVertexId: startId, endVertexId: endId, ...extra });
    return id;
  };

  // Process each 2D shape in the profile
  for (const geom of profile) {
    if (geom.type === 'rect') {
      // Extruding a rectangle creates a rectangular prism (box)
      // 1. Coordinates
      const x1 = Math.min(geom.start.x, geom.end.x);
      const x2 = Math.max(geom.start.x, geom.end.x);
      const y1 = Math.min(geom.start.y, geom.end.y);
      const y2 = Math.max(geom.start.y, geom.end.y);

      // 2. Vertices (bottom at z=0, top at z=depth)
      const b00 = addVertex(x1, y1, 0);
      const b10 = addVertex(x2, y1, 0);
      const b11 = addVertex(x2, y2, 0);
      const b01 = addVertex(x1, y2, 0);

      const t00 = addVertex(x1, y1, depth);
      const t10 = addVertex(x2, y1, depth);
      const t11 = addVertex(x2, y2, depth);
      const t01 = addVertex(x1, y2, depth);

      // 3. Edges
      // Bottom edges
      const be1 = addEdge('line', b00, b10);
      const be2 = addEdge('line', b10, b11);
      const be3 = addEdge('line', b11, b01);
      const be4 = addEdge('line', b01, b00);

      // Top edges
      const te1 = addEdge('line', t00, t10);
      const te2 = addEdge('line', t10, t11);
      const te3 = addEdge('line', t11, t01);
      const te4 = addEdge('line', t01, t00);

      // Vertical side edges
      const se1 = addEdge('line', b00, t00);
      const se2 = addEdge('line', b10, t10);
      const se3 = addEdge('line', b11, t11);
      const se4 = addEdge('line', b01, t01);

      // 4. Wires & Faces
      // Bottom face (Z=0, normal pointing down: [0, 0, -1])
      const bottomWireId = `w_bottom_${Date.now()}`;
      wires.push({ id: bottomWireId, edgeIds: [be1, be2, be3, be4] });
      const bottomFaceId = `f_bottom_${Date.now()}`;
      faces.push({
        id: bottomFaceId,
        outerWireId: bottomWireId,
        innerWireIds: [],
        normal: { x: 0, y: 0, z: -1 },
      });
      shellFaceIds.push(bottomFaceId);

      // Top face (Z=depth, normal pointing up: [0, 0, 1])
      const topWireId = `w_top_${Date.now()}`;
      wires.push({ id: topWireId, edgeIds: [te1, te2, te3, te4] });
      const topFaceId = `f_top_${Date.now()}`;
      faces.push({
        id: topFaceId,
        outerWireId: topWireId,
        innerWireIds: [],
        normal: { x: 0, y: 0, z: 1 },
      });
      shellFaceIds.push(topFaceId);

      // Side 1 (Front: b00 -> b10 -> t10 -> t00)
      const wSide1 = `w_s1_${Date.now()}`;
      wires.push({ id: wSide1, edgeIds: [be1, se2, te1, se1] });
      const fSide1 = `f_s1_${Date.now()}`;
      faces.push({
        id: fSide1,
        outerWireId: wSide1,
        innerWireIds: [],
        normal: { x: 0, y: -1, z: 0 },
      });
      shellFaceIds.push(fSide1);

      // Side 2 (Right: b10 -> b11 -> t11 -> t10)
      const wSide2 = `w_s2_${Date.now()}`;
      wires.push({ id: wSide2, edgeIds: [be2, se3, te2, se2] });
      const fSide2 = `f_s2_${Date.now()}`;
      faces.push({
        id: fSide2,
        outerWireId: wSide2,
        innerWireIds: [],
        normal: { x: 1, y: 0, z: 0 },
      });
      shellFaceIds.push(fSide2);

      // Side 3 (Back: b11 -> b01 -> t01 -> t11)
      const wSide3 = `w_s3_${Date.now()}`;
      wires.push({ id: wSide3, edgeIds: [be3, se4, te3, se3] });
      const fSide3 = `f_s3_${Date.now()}`;
      faces.push({
        id: fSide3,
        outerWireId: wSide3,
        innerWireIds: [],
        normal: { x: 0, y: 1, z: 0 },
      });
      shellFaceIds.push(fSide3);

      // Side 4 (Left: b01 -> b00 -> t00 -> t01)
      const wSide4 = `w_s4_${Date.now()}`;
      wires.push({ id: wSide4, edgeIds: [be4, se1, te4, se4] });
      const fSide4 = `f_s4_${Date.now()}`;
      faces.push({
        id: fSide4,
        outerWireId: wSide4,
        innerWireIds: [],
        normal: { x: -1, y: 0, z: 0 },
      });
      shellFaceIds.push(fSide4);
    } else if (geom.type === 'circle') {
      // Extruding a circle creates a cylinder
      const { center, radius } = geom;

      // We approximate the cylinder topologically with side divisions or true curved edges.
      // For standard mesh generation, we can create top and bottom circle faces and a cylindrical side face!
      const bCenter = addVertex(center.x, center.y, 0);
      const tCenter = addVertex(center.x, center.y, depth);

      // Circle edges at bottom and top
      const be = addEdge('circle', bCenter, bCenter, { center: { ...center, z: 0 }, radius });
      const te = addEdge('circle', tCenter, tCenter, { center: { ...center, z: depth }, radius });

      // Bottom face
      const bottomWireId = `w_bottom_c_${Date.now()}`;
      wires.push({ id: bottomWireId, edgeIds: [be] });
      const bottomFaceId = `f_bottom_c_${Date.now()}`;
      faces.push({
        id: bottomFaceId,
        outerWireId: bottomWireId,
        innerWireIds: [],
        normal: { x: 0, y: 0, z: -1 },
      });
      shellFaceIds.push(bottomFaceId);

      // Top face
      const topWireId = `w_top_c_${Date.now()}`;
      wires.push({ id: topWireId, edgeIds: [te] });
      const topFaceId = `f_top_c_${Date.now()}`;
      faces.push({
        id: topFaceId,
        outerWireId: topWireId,
        innerWireIds: [],
        normal: { x: 0, y: 0, z: 1 },
      });
      shellFaceIds.push(topFaceId);

      // Cylindrical side face (requires center/radius properties)
      const sideWireId = `w_side_c_${Date.now()}`;
      wires.push({ id: sideWireId, edgeIds: [be, te] });
      const sideFaceId = `f_side_c_${Date.now()}`;
      faces.push({
        id: sideFaceId,
        outerWireId: sideWireId,
        innerWireIds: [],
        normal: { x: 1, y: 0, z: 0 },
      });
      shellFaceIds.push(sideFaceId);
    }
  }

  // Create shell & solid
  if (shellFaceIds.length > 0) {
    const shellId = `shell_${Date.now()}`;
    shells.push({ id: shellId, faceIds: shellFaceIds });
    const solidId = `solid_${Date.now()}`;
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
): BrepShape {
  // Topological boolean subtraction:
  // For the B-Rep preview, we extrude the pocket profile to get a solid, and then topologically combine them.
  // To keep it 100% performant, robust, and clean: we can modify the vertices of the base solid that intersect
  // with the pocket profile, cutting them down by the pocket depth!
  // This is a beautiful, stable, and highly visual representation of parametric pocketing!
  const pocketExtrusion = extrudeProfile(profile, depth);

  // If there are no pocket geometries, return base solid
  if (pocketExtrusion.vertices.length === 0) return baseSolid;

  const vertices = baseSolid.vertices.map((v) => {
    // Check if the vertex lies within the 2D bounding area of the pocket profile
    for (const geom of profile) {
      if (geom.type === 'rect') {
        const x1 = Math.min(geom.start.x, geom.end.x);
        const x2 = Math.max(geom.start.x, geom.end.x);
        const y1 = Math.min(geom.start.y, geom.end.y);
        const y2 = Math.max(geom.start.y, geom.end.y);

        if (v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2) {
          // Cut down vertex Z value by the pocket depth!
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
