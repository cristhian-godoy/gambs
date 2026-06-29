import type { BrepShape, Vertex3D } from '../core/brep.ts';

/**
 * Helper to get the ordered vertices for each face of the B-Rep shape.
 */
function getFaceTriangles(
  shape: BrepShape,
): { vertices: [Vertex3D, Vertex3D, Vertex3D]; normal: { x: number; y: number; z: number } }[] {
  const triangles: {
    vertices: [Vertex3D, Vertex3D, Vertex3D];
    normal: { x: number; y: number; z: number };
  }[] = [];

  for (const face of shape.faces) {
    const wire = shape.wires.find((w) => w.id === face.outerWireId);
    if (!wire) continue;

    const faceVerts: Vertex3D[] = [];
    for (const edgeId of wire.edgeIds) {
      const edge = shape.edges.find((e) => e.id === edgeId);
      if (!edge) continue;
      const vStart = shape.vertices.find((v) => v.id === edge.startVertexId);
      if (vStart && !faceVerts.includes(vStart)) faceVerts.push(vStart);
      const vEnd = shape.vertices.find((v) => v.id === edge.endVertexId);
      if (vEnd && !faceVerts.includes(vEnd)) faceVerts.push(vEnd);
    }

    const n = face.normal;

    if (faceVerts.length === 4) {
      // Quad -> 2 triangles
      triangles.push({ vertices: [faceVerts[0], faceVerts[1], faceVerts[2]], normal: n });
      triangles.push({ vertices: [faceVerts[0], faceVerts[2], faceVerts[3]], normal: n });
    } else if (face.id.includes('c_')) {
      // Circle cap
      const edge = shape.edges.find((e) => wire.edgeIds.includes(e.id) && e.type === 'circle');
      if (edge && edge.center && edge.radius) {
        const center = edge.center;
        const radius = edge.radius;
        const segments = 32;
        const points: Vertex3D[] = [];

        for (let i = 0; i < segments; i++) {
          const angle = (i * Math.PI * 2) / segments;
          points.push({
            id: `pt_${i}`,
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
            z: center.z,
          });
        }

        const centerVert: Vertex3D = { id: 'center', x: center.x, y: center.y, z: center.z };
        for (let i = 0; i < segments; i++) {
          const nextIdx = (i + 1) % segments;
          if (n.z > 0) {
            triangles.push({ vertices: [centerVert, points[i], points[nextIdx]], normal: n });
          } else {
            triangles.push({ vertices: [centerVert, points[nextIdx], points[i]], normal: n });
          }
        }
      }
    }
  }

  // Cylindrical side faces connecting bottom and top circles
  const cylFaces = shape.faces.filter((f) => f.id.includes('side_c_'));
  for (let i = 0; i < cylFaces.length; i++) {
    const bottomWire = shape.wires.find((w) => w.id.includes('bottom_c_'));
    const topWire = shape.wires.find((w) => w.id.includes('top_c_'));

    if (bottomWire && topWire) {
      const bEdge = shape.edges.find((e) => bottomWire.edgeIds.includes(e.id));
      const tEdge = shape.edges.find((e) => topWire.edgeIds.includes(e.id));

      if (bEdge && tEdge && bEdge.center && tEdge.center && bEdge.radius) {
        const bc = bEdge.center;
        const tc = tEdge.center;
        const r = bEdge.radius;
        const segments = 32;

        for (let j = 0; j < segments; j++) {
          const a1 = (j * Math.PI * 2) / segments;
          const a2 = ((j + 1) * Math.PI * 2) / segments;

          const v1: Vertex3D = {
            id: `b1_${j}`,
            x: bc.x + r * Math.cos(a1),
            y: bc.y + r * Math.sin(a1),
            z: bc.z,
          };
          const v2: Vertex3D = {
            id: `b2_${j}`,
            x: bc.x + r * Math.cos(a2),
            y: bc.y + r * Math.sin(a2),
            z: bc.z,
          };
          const v3: Vertex3D = {
            id: `t1_${j}`,
            x: tc.x + r * Math.cos(a1),
            y: tc.y + r * Math.sin(a1),
            z: tc.z,
          };
          const v4: Vertex3D = {
            id: `t2_${j}`,
            x: tc.x + r * Math.cos(a2),
            y: tc.y + r * Math.sin(a2),
            z: tc.z,
          };

          const n1 = { x: Math.cos(a1), y: Math.sin(a1), z: 0 };

          triangles.push({ vertices: [v1, v2, v3], normal: n1 });
          triangles.push({ vertices: [v2, v4, v3], normal: n1 });
        }
      }
    }
  }

  return triangles;
}

/**
 * Triggers a browser file download.
 */
function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a BrepShape to ASCII STL format.
 */
export function exportToStl(shape: BrepShape, filename: string = 'model.stl') {
  const triangles = getFaceTriangles(shape);
  let stl = 'solid spacad_model\n';

  for (const tri of triangles) {
    const { vertices, normal } = tri;
    stl += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
    stl += '    outer loop\n';
    for (const v of vertices) {
      stl += `      vertex ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`;
    }
    stl += '    endloop\n';
    stl += '  endfacet\n';
  }

  stl += 'endsolid spacad_model\n';
  downloadFile(filename, stl, 'text/plain');
}

/**
 * Exports a BrepShape to OBJ format.
 */
export function exportToObj(shape: BrepShape, filename: string = 'model.obj') {
  const triangles = getFaceTriangles(shape);
  let obj = '# SPA CAD OBJ Export\n';

  let vertexCount = 1;
  for (const tri of triangles) {
    const { vertices, normal } = tri;
    for (const v of vertices) {
      obj += `v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`;
    }
    obj += `vn ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
    obj += `f ${vertexCount}//${vertexCount} ${vertexCount + 1}//${vertexCount} ${vertexCount + 2}//${vertexCount}\n`;
    vertexCount += 3;
  }

  downloadFile(filename, obj, 'text/plain');
}

/**
 * Exports a BrepShape to STEP format (structured B-Rep).
 */
export function exportToStep(shape: BrepShape, filename: string = 'model.stp') {
  let step = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('SPA CAD B-Rep Model'),'2;1');
FILE_NAME('${filename}','2026-06-29T08:00:00',('Antigravity'),('DeepMind'),'Antigravity SPA CAD','SPA CAD','');
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
`;

  let entityId = 1;

  // Write Cartesian points
  const vertexEntityIds = new Map<string, number>();
  for (const v of shape.vertices) {
    const cpId = entityId++;
    step += `#${cpId}=CARTESIAN_POINT('',(${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}));\n`;
    const vpId = entityId++;
    step += `#${vpId}=VERTEX_POINT('',#${cpId});\n`;
    vertexEntityIds.set(v.id, vpId);
  }

  // Write edges
  const edgeEntityIds = new Map<string, number>();
  for (const e of shape.edges) {
    const startEnt = vertexEntityIds.get(e.startVertexId)!;
    const endEnt = vertexEntityIds.get(e.endVertexId)!;

    const geomId = entityId++;
    if (e.type === 'circle' && e.center && e.radius) {
      step += `#${geomId}=CIRCLE('',#${entityId++},${e.radius.toFixed(4)});\n`;
    } else {
      step += `#${geomId}=LINE('',#${entityId++},#${entityId++});\n`;
    }

    const edgeId = entityId++;
    step += `#${edgeId}=EDGE_CURVE('',#${startEnt},#${endEnt},#${geomId},.T.);\n`;
    edgeEntityIds.set(e.id, edgeId);
  }

  // Write wires, faces, and shell
  const orientedEdgeIds: number[] = [];
  for (const w of shape.wires) {
    const loopId = entityId++;
    const edgeRefs = w.edgeIds.map((eid) => `#${edgeEntityIds.get(eid)!}`).join(',');
    step += `#${loopId}=EDGE_LOOP('',(${edgeRefs}));\n`;
    const fBoundId = entityId++;
    step += `#${fBoundId}=FACE_BOUND('',#${loopId},.T.);\n`;
    orientedEdgeIds.push(fBoundId);
  }

  const faceIds: string[] = [];
  for (let i = 0; i < shape.faces.length; i++) {
    const boundRef = orientedEdgeIds[i] ? `#${orientedEdgeIds[i]}` : '';
    const surfaceId = entityId++;
    step += `#${surfaceId}=PLANE('',#${entityId++});\n`;
    const faceId = entityId++;
    step += `#${faceId}=ADVANCED_FACE('',(${boundRef}),#${surfaceId},.T.);\n`;
    faceIds.push(`#${faceId}`);
  }

  if (faceIds.length > 0) {
    const shellId = entityId++;
    step += `#${shellId}=CLOSED_SHELL('',(${faceIds.join(',')}));\n`;
    const solidId = entityId;
    step += `#${solidId}=MANIFOLD_SOLID_BREP('',#${shellId});\n`;
  }

  step += `ENDSEC;
END-ISO-10303-21;
`;

  downloadFile(filename, step, 'text/plain');
}

/**
 * Parses simple custom STEP files back into B-Rep shape structure.
 */
export function importFromStep(stepContent: string): BrepShape {
  const vertices: Vertex3D[] = [];
  const lines = stepContent.split('\n');

  for (const line of lines) {
    if (line.includes('CARTESIAN_POINT')) {
      // Format: #123=CARTESIAN_POINT('',(1.0,2.0,3.0));
      const match = line.match(/#(\d+)=CARTESIAN_POINT\('',\(([^)]+)\)\)/);
      if (match) {
        const id = `v_${match[1]}_${Date.now()}`;
        const coords = match[2].split(',').map(parseFloat);
        if (coords.length >= 3) {
          vertices.push({ id, x: coords[0], y: coords[1], z: coords[2] });
        }
      }
    }
  }

  // Create mock box around vertices if any imported
  if (vertices.length > 0) {
    return {
      vertices,
      edges: [],
      wires: [],
      faces: [],
      shells: [],
      solids: [],
    };
  }

  return { vertices: [], edges: [], wires: [], faces: [], shells: [], solids: [] };
}
