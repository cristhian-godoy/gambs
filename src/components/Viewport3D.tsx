import { type ReactNode, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { BrepShape, extrudeProfile, pocketProfile, Vertex3D } from '../core/brep.ts';
import { useCad } from '../store/CadContext.tsx';
import { SketchGeometry } from '../store/types.ts';

/**
 * Helper to build THREE.BufferGeometry from a BrepShape solid.
 */
function buildThreeGeometry(shape: BrepShape): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];

  // Group vertices by face to tessellate
  for (const face of shape.faces) {
    const wire = shape.wires.find((w) => w.id === face.outerWireId);
    if (!wire) continue;

    // Get ordered vertices of the wire
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
      // Quad face -> 2 triangles
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
      // Circle cap face
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

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Interactive 3D viewport using Three.js for CAD model visualization.
 * Supports pan, tilt, zoom, grid floors, and dynamic solid rendering.
 * @returns The rendered Viewport3D component.
 */
export default function Viewport3D(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Consume features to rebuild meshes when features change
  const { documentState } = useCad();
  const { features } = documentState;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a'); // sleek dark slate background

    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(50, 50, 100);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 3. Grid and Axes
    const gridHelper = new THREE.GridHelper(200, 50, '#334155', '#1e293b');
    gridHelper.rotation.x = Math.PI / 2; // Lie grid on XY plane
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight('#ffffff', '#444444', 1.5);
    hemiLight.position.set(0, 0, 100);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.0);
    dirLight.position.set(50, 50, 100);
    scene.add(dirLight);

    // 5. Evaluate features chronologically to build solid B-Rep representation
    let solid: BrepShape | null = null;
    let currentSketchGeoms: SketchGeometry[] = [];

    for (const f of features) {
      if (f.type === 'sketch') {
        currentSketchGeoms = (f.params.geometries as SketchGeometry[]) || [];
      } else if (f.type === 'pad') {
        const distanceVal = (f.params.distance as number) ?? 10;
        solid = extrudeProfile(currentSketchGeoms, distanceVal);
      } else if (f.type === 'pocket') {
        const distanceVal = (f.params.distance as number) ?? 5;
        if (solid) {
          solid = pocketProfile(solid, currentSketchGeoms, distanceVal);
        }
      }
    }

    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.MeshStandardMaterial | null = null;
    let wireframeGeom: THREE.EdgesGeometry | null = null;
    let wireframeMat: THREE.LineBasicMaterial | null = null;

    if (solid && solid.vertices.length > 0) {
      geometry = buildThreeGeometry(solid);
      material = new THREE.MeshStandardMaterial({
        color: '#38bdf8', // beautiful light blue
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // Wireframe edges overlay
      wireframeGeom = new THREE.EdgesGeometry(geometry);
      wireframeMat = new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 1.5 });
      const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
      mesh.add(wireframe);
    } else {
      // No 3D solids created yet -> Render simple translucent grid box
      geometry = new THREE.BoxGeometry(20, 20, 20);
      material = new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.5,
        transparent: true,
        opacity: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      wireframeGeom = new THREE.EdgesGeometry(geometry);
      wireframeMat = new THREE.LineBasicMaterial({ color: '#475569', linewidth: 1.0 });
      const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
      mesh.add(wireframe);
    }

    // 6. Animation loop
    let animationFrameId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // 7. Resize Handler
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      geometry?.dispose();
      material?.dispose();
      wireframeGeom?.dispose();
      wireframeMat?.dispose();
    };
  }, [features]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
