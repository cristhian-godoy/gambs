import { type BrepShape, buildSolidFromFeatures, type Vertex3D } from './brep.ts';

// Helper to build raw position & normal arrays for Three.js
function tessellateSolid(shape: BrepShape) {
  const positions: number[] = [];
  const normals: number[] = [];
  const linePositions: number[] = [];

  if (!shape || shape.vertices.length === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      linePositions: new Float32Array(0),
    };
  }

  // Same logic as Viewport3D.tsx buildThreeGeometry
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
      const addTriangle = (p1: Vertex3D, p2: Vertex3D, p3: Vertex3D) => {
        positions.push(p1.x, p1.y, p1.z);
        positions.push(p2.x, p2.y, p2.z);
        positions.push(p3.x, p3.y, p3.z);
        normals.push(n.x, n.y, n.z);
        normals.push(n.x, n.y, n.z);
        normals.push(n.x, n.y, n.z);
      };
      addTriangle(faceVerts[0], faceVerts[1], faceVerts[2]);
      addTriangle(faceVerts[0], faceVerts[2], faceVerts[3]);
    } else if (face.id.includes('c_')) {
      const edge = shape.edges.find((e) => wire.edgeIds.includes(e.id) && e.type === 'circle');
      if (edge && edge.center && edge.radius) {
        const center = edge.center;
        const radius = edge.radius;
        const segments = 32;

        if (face.id.includes('bottom') || face.id.includes('top')) {
          const capZ = center.z;
          const points: { x: number; y: number }[] = [];
          for (let i = 0; i < segments; i++) {
            const angle = (i * Math.PI * 2) / segments;
            points.push({
              x: center.x + radius * Math.cos(angle),
              y: center.y + radius * Math.sin(angle),
            });
          }

          for (let i = 0; i < segments; i++) {
            const nextIdx = (i + 1) % segments;
            positions.push(center.x, center.y, capZ);
            if (n.z > 0) {
              positions.push(points[i].x, points[i].y, capZ);
              positions.push(points[nextIdx].x, points[nextIdx].y, capZ);
            } else {
              positions.push(points[nextIdx].x, points[nextIdx].y, capZ);
              positions.push(points[i].x, points[i].y, capZ);
            }
            normals.push(n.x, n.y, n.z);
            normals.push(n.x, n.y, n.z);
            normals.push(n.x, n.y, n.z);
          }
        }
      }
    }
  }

  // Cylindrical side faces connecting bottom and top circles
  const cylFaces = shape.faces.filter((f) => f.id.includes('side_c_'));
  for (let fIdx = 0; fIdx < cylFaces.length; fIdx++) {
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

        for (let i = 0; i < segments; i++) {
          const a1 = (i * Math.PI * 2) / segments;
          const a2 = ((i + 1) * Math.PI * 2) / segments;

          const bx1 = bc.x + r * Math.cos(a1);
          const by1 = bc.y + r * Math.sin(a1);
          const bx2 = bc.x + r * Math.cos(a2);
          const by2 = bc.y + r * Math.sin(a2);

          const tx1 = tc.x + r * Math.cos(a1);
          const ty1 = tc.y + r * Math.sin(a1);
          const tx2 = tc.x + r * Math.cos(a2);
          const ty2 = tc.y + r * Math.sin(a2);

          const nx1 = Math.cos(a1);
          const ny1 = Math.sin(a1);
          const nx2 = Math.cos(a2);
          const ny2 = Math.sin(a2);

          positions.push(bx1, by1, bc.z);
          positions.push(bx2, by2, bc.z);
          positions.push(tx1, ty1, tc.z);
          normals.push(nx1, ny1, 0);
          normals.push(nx2, ny2, 0);
          normals.push(nx1, ny1, 0);

          positions.push(bx2, by2, bc.z);
          positions.push(tx2, ty2, tc.z);
          positions.push(tx1, ty1, tc.z);
          normals.push(nx2, ny2, 0);
          normals.push(nx2, ny2, 0);
          normals.push(nx1, ny1, 0);
        }
      }
    }
  }

  // If no face triangles were added but edges exist, it's a wire frame/line model (e.g. Helix)
  if (positions.length === 0 && shape.edges.length > 0) {
    for (const edge of shape.edges) {
      const vStart = shape.vertices.find((v) => v.id === edge.startVertexId);
      const vEnd = shape.vertices.find((v) => v.id === edge.endVertexId);
      if (vStart && vEnd) {
        linePositions.push(vStart.x, vStart.y, vStart.z);
        linePositions.push(vEnd.x, vEnd.y, vEnd.z);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    linePositions: new Float32Array(linePositions),
  };
}

self.onmessage = (e: MessageEvent) => {
  const { type, features } = e.data;
  if (type === 'BUILD_SOLID') {
    try {
      const solid = buildSolidFromFeatures(features);
      const { positions, normals, linePositions } = tessellateSolid(solid);

      self.postMessage(
        {
          type: 'BUILD_SOLID_SUCCESS',
          solid,
          positions,
          normals,
          linePositions,
        },
        [positions.buffer, normals.buffer, linePositions.buffer],
      );
    } catch (err) {
      self.postMessage({
        type: 'BUILD_SOLID_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
