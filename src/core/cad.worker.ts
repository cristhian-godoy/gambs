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
          const points: { x: number; y: number; z: number }[] = [];
          for (let i = 0; i < segments; i++) {
            const angle = (i * Math.PI * 2) / segments;
            if (Math.abs(n.x) > 0.9) {
              points.push({
                x: center.x,
                y: center.y + radius * Math.cos(angle),
                z: center.z + radius * Math.sin(angle),
              });
            } else if (Math.abs(n.y) > 0.9) {
              points.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y,
                z: center.z + radius * Math.sin(angle),
              });
            } else {
              points.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
                z: center.z,
              });
            }
          }

          for (let i = 0; i < segments; i++) {
            const nextIdx = (i + 1) % segments;
            positions.push(center.x, center.y, center.z);
            if (n.x + n.y + n.z > 0) {
              positions.push(points[i].x, points[i].y, points[i].z);
              positions.push(points[nextIdx].x, points[nextIdx].y, points[nextIdx].z);
            } else {
              positions.push(points[nextIdx].x, points[nextIdx].y, points[nextIdx].z);
              positions.push(points[i].x, points[i].y, points[i].z);
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
          const angle = (i * Math.PI * 2) / segments;
          const nextAngle = ((i + 1) * Math.PI * 2) / segments;

          let b1: { x: number; y: number; z: number };
          let b2: { x: number; y: number; z: number };
          let t1: { x: number; y: number; z: number };
          let t2: { x: number; y: number; z: number };
          let normalDir: { x: number; y: number; z: number };

          const dx = tc.x - bc.x;
          const dy = tc.y - bc.y;

          if (Math.abs(dx) > 0.9) {
            b1 = { x: bc.x, y: bc.y + r * Math.cos(angle), z: bc.z + r * Math.sin(angle) };
            b2 = { x: bc.x, y: bc.y + r * Math.cos(nextAngle), z: bc.z + r * Math.sin(nextAngle) };
            t1 = { x: tc.x, y: tc.y + r * Math.cos(angle), z: tc.z + r * Math.sin(angle) };
            t2 = { x: tc.x, y: tc.y + r * Math.cos(nextAngle), z: tc.z + r * Math.sin(nextAngle) };
            normalDir = {
              x: 0,
              y: Math.cos((angle + nextAngle) / 2),
              z: Math.sin((angle + nextAngle) / 2),
            };
          } else if (Math.abs(dy) > 0.9) {
            b1 = { x: bc.x + r * Math.cos(angle), y: bc.y, z: bc.z + r * Math.sin(angle) };
            b2 = { x: bc.x + r * Math.cos(nextAngle), y: bc.y, z: bc.z + r * Math.sin(nextAngle) };
            t1 = { x: tc.x + r * Math.cos(angle), y: tc.y, z: tc.z + r * Math.sin(angle) };
            t2 = { x: tc.x + r * Math.cos(nextAngle), y: tc.y, z: tc.z + r * Math.sin(nextAngle) };
            normalDir = {
              x: Math.cos((angle + nextAngle) / 2),
              y: 0,
              z: Math.sin((angle + nextAngle) / 2),
            };
          } else {
            b1 = { x: bc.x + r * Math.cos(angle), y: bc.y + r * Math.sin(angle), z: bc.z };
            b2 = { x: bc.x + r * Math.cos(nextAngle), y: bc.y + r * Math.sin(nextAngle), z: bc.z };
            t1 = { x: tc.x + r * Math.cos(angle), y: tc.y + r * Math.sin(angle), z: tc.z };
            t2 = { x: tc.x + r * Math.cos(nextAngle), y: tc.y + r * Math.sin(nextAngle), z: tc.z };
            normalDir = {
              x: Math.cos((angle + nextAngle) / 2),
              y: Math.sin((angle + nextAngle) / 2),
              z: 0,
            };
          }

          positions.push(b1.x, b1.y, b1.z);
          positions.push(b2.x, b2.y, b2.z);
          positions.push(t1.x, t1.y, t1.z);
          normals.push(normalDir.x, normalDir.y, normalDir.z);
          normals.push(normalDir.x, normalDir.y, normalDir.z);
          normals.push(normalDir.x, normalDir.y, normalDir.z);

          positions.push(b2.x, b2.y, b2.z);
          positions.push(t2.x, t2.y, t2.z);
          positions.push(t1.x, t1.y, t1.z);
          normals.push(normalDir.x, normalDir.y, normalDir.z);
          normals.push(normalDir.x, normalDir.y, normalDir.z);
          normals.push(normalDir.x, normalDir.y, normalDir.z);
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
