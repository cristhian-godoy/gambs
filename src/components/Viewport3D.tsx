import { type ReactNode, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { type BrepShape, buildSolidFromFeatures, type Vertex3D } from '../core/brep.ts';
import { useCad } from '../store/CadContext.tsx';

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
 * Helper to build a flat Mesh representing a plane label (e.g. XY, YZ, ZX).
 */
function createPlaneMeshLabel(text: string, color: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(0, 0, 128, 64, 12);
    } else {
      ctx.rect(0, 0, 128, 64);
    }
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const geom = new THREE.PlaneGeometry(10, 5);
  const mesh = new THREE.Mesh(geom, material);
  return mesh;
}

/**
 * Interactive 3D viewport using Three.js for CAD model visualization.
 * Supports pan, tilt, zoom, grid floors, and dynamic solid rendering.
 * @returns The rendered Viewport3D component.
 */
export default function Viewport3D(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoCanvasRef = useRef<HTMLCanvasElement>(null);

  // Consume features to rebuild meshes when features change
  const { documentState, settings } = useCad();
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
    if (camera.up) {
      camera.up.set(0, 0, 1); // Z-up orientation
    }
    camera.position.set(80, -120, 80);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Define keyboard listeners outside conditional block to expose to cleanup
    let handleKeyDown: ((e: KeyboardEvent) => void) | undefined;
    let handleKeyUp: ((e: KeyboardEvent) => void) | undefined;

    if (settings.navigationStyle === 'blender') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.NONE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.NONE,
      };

      handleKeyDown = (e: KeyboardEvent) => {
        if (e.shiftKey) {
          controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
        }
      };

      handleKeyUp = (e: KeyboardEvent) => {
        if (!e.shiftKey) {
          controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }

    // 3. Dynamic Datum Features Rendering
    const datumGeometries: (THREE.BufferGeometry | THREE.Material)[] = [];

    const originFeat = features.find((f) => f.id === 'datum_origin');
    if (originFeat && originFeat.params.visible !== false) {
      const originGeom = new THREE.SphereGeometry(0.8, 16, 16);
      const originMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
      datumGeometries.push(originGeom, originMat);
      const originMesh = new THREE.Mesh(originGeom, originMat);
      scene.add(originMesh);
    }

    const axisXFeat = features.find((f) => f.id === 'datum_axis_x');
    if (axisXFeat && axisXFeat.params.visible !== false) {
      const pointsX = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 0, 0)];
      const geomX = new THREE.BufferGeometry().setFromPoints(pointsX);
      const matX = new THREE.LineBasicMaterial({ color: '#ef4444' }); // Red
      datumGeometries.push(geomX, matX);
      const lineX = new THREE.Line(geomX, matX);
      scene.add(lineX);
    }

    const axisYFeat = features.find((f) => f.id === 'datum_axis_y');
    if (axisYFeat && axisYFeat.params.visible !== false) {
      const pointsY = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 100, 0)];
      const geomY = new THREE.BufferGeometry().setFromPoints(pointsY);
      const matY = new THREE.LineBasicMaterial({ color: '#22c55e' }); // Green
      datumGeometries.push(geomY, matY);
      const lineY = new THREE.Line(geomY, matY);
      scene.add(lineY);
    }

    const axisZFeat = features.find((f) => f.id === 'datum_axis_z');
    if (axisZFeat && axisZFeat.params.visible !== false) {
      const pointsZ = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 100)];
      const geomZ = new THREE.BufferGeometry().setFromPoints(pointsZ);
      const matZ = new THREE.LineBasicMaterial({ color: '#3b82f6' }); // Blue
      datumGeometries.push(geomZ, matZ);
      const lineZ = new THREE.Line(geomZ, matZ);
      scene.add(lineZ);
    }

    const planeXYFeat = features.find((f) => f.id === 'datum_plane_xy');
    const labelOffset = (settings.gridSize / 2) * 0.9;

    if (planeXYFeat && planeXYFeat.params.visible !== false) {
      const xyGrid = new THREE.GridHelper(
        settings.gridSize,
        settings.gridDivisions,
        '#475569',
        '#1e293b',
      );
      xyGrid.rotation.x = Math.PI / 2;
      xyGrid.position.z = -0.01;
      scene.add(xyGrid);

      const label = createPlaneMeshLabel('XY', '#ef4444');
      label.position.set(labelOffset, labelOffset, 0);
      scene.add(label);

      datumGeometries.push(
        xyGrid.geometry,
        xyGrid.material as THREE.Material,
        label.geometry,
        label.material,
        label.material.map!,
      );
    }

    const planeYZFeat = features.find((f) => f.id === 'datum_plane_yz');
    if (planeYZFeat && planeYZFeat.params.visible !== false) {
      const yzGrid = new THREE.GridHelper(
        settings.gridSize,
        settings.gridDivisions,
        '#475569',
        '#1e293b',
      );
      yzGrid.rotation.z = Math.PI / 2;
      yzGrid.position.x = -0.01;
      scene.add(yzGrid);

      const label = createPlaneMeshLabel('YZ', '#22c55e');
      label.position.set(0, labelOffset, labelOffset);
      label.rotation.y = Math.PI / 2;
      scene.add(label);

      datumGeometries.push(
        yzGrid.geometry,
        yzGrid.material as THREE.Material,
        label.geometry,
        label.material,
        label.material.map!,
      );
    }

    const planeZXFeat = features.find((f) => f.id === 'datum_plane_zx');
    if (planeZXFeat && planeZXFeat.params.visible !== false) {
      const zxGrid = new THREE.GridHelper(
        settings.gridSize,
        settings.gridDivisions,
        '#475569',
        '#1e293b',
      );
      zxGrid.position.y = -0.01;
      scene.add(zxGrid);

      const label = createPlaneMeshLabel('ZX', '#3b82f6');
      label.position.set(labelOffset, 0, labelOffset);
      label.rotation.x = Math.PI / 2;
      scene.add(label);

      datumGeometries.push(
        zxGrid.geometry,
        zxGrid.material as THREE.Material,
        label.geometry,
        label.material,
        label.material.map!,
      );
    }

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight('#ffffff', '#444444', 1.5);
    hemiLight.position.set(0, 0, 100);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.0);
    dirLight.position.set(50, 50, 100);
    scene.add(dirLight);

    // 5. Evaluate features chronologically to build solid B-Rep representation
    const solid = buildSolidFromFeatures(features);

    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.MeshStandardMaterial | null = null;
    let wireframeGeom: THREE.EdgesGeometry | null = null;
    let wireframeMat: THREE.LineBasicMaterial | null = null;

    if (solid && solid.vertices.length > 0) {
      if (solid.faces.length > 0) {
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
        // Render as 3D line path (e.g. Helix)
        const linePositions: number[] = [];
        for (const edge of solid.edges) {
          const vStart = solid.vertices.find((v) => v.id === edge.startVertexId);
          const vEnd = solid.vertices.find((v) => v.id === edge.endVertexId);
          if (vStart && vEnd) {
            linePositions.push(vStart.x, vStart.y, vStart.z);
            linePositions.push(vEnd.x, vEnd.y, vEnd.z);
          }
        }
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: '#f59e0b', linewidth: 2.0 });
        const line = new THREE.LineSegments(geometry, lineMat);
        scene.add(line);
      }
    } else {
      // Empty canvas by default
    }

    // 6. Animation loop
    const gizmoCanvas = gizmoCanvasRef.current;
    const gizmoCtx = gizmoCanvas?.getContext('2d');

    let animationFrameId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);

      if (gizmoCtx && gizmoCanvas) {
        gizmoCtx.clearRect(0, 0, gizmoCanvas.width, gizmoCanvas.height);

        const cx = gizmoCanvas.width / 2;
        const cy = gizmoCanvas.height / 2;
        const size = 28;

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        const axes = [
          { name: 'X', dir: new THREE.Vector3(1, 0, 0), color: '#ef4444' },
          { name: 'Y', dir: new THREE.Vector3(0, 1, 0), color: '#22c55e' },
          { name: 'Z', dir: new THREE.Vector3(0, 0, 1), color: '#3b82f6' },
        ];

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        axes.sort((a, b) => a.dir.dot(forward) - b.dir.dot(forward));

        for (const axis of axes) {
          const dx = axis.dir.dot(right);
          const dy = axis.dir.dot(up);

          const ex = cx + dx * size;
          const ey = cy - dy * size;

          gizmoCtx.beginPath();
          gizmoCtx.moveTo(cx, cy);
          gizmoCtx.lineTo(ex, ey);
          gizmoCtx.strokeStyle = axis.color;
          gizmoCtx.lineWidth = 3;
          gizmoCtx.lineCap = 'round';
          gizmoCtx.stroke();

          gizmoCtx.fillStyle = '#f8fafc';
          gizmoCtx.font = 'bold 11px sans-serif';
          gizmoCtx.textAlign = 'center';
          gizmoCtx.textBaseline = 'middle';
          gizmoCtx.fillText(axis.name, ex + dx * 8, ey - dy * 8);
        }

        gizmoCtx.beginPath();
        gizmoCtx.arc(cx, cy, 3, 0, Math.PI * 2);
        gizmoCtx.fillStyle = '#64748b';
        gizmoCtx.fill();
      }

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
      datumGeometries.forEach((d) => d?.dispose?.());
      if (handleKeyDown) window.removeEventListener('keydown', handleKeyDown);
      if (handleKeyUp) window.removeEventListener('keyup', handleKeyUp);
    };
  }, [features, settings]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <canvas
        ref={gizmoCanvasRef}
        width={100}
        height={100}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          width: '100px',
          height: '100px',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
