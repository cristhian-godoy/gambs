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
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 16;
    ctx.moveTo(8 + r, 8);
    ctx.lineTo(120 - r, 8);
    ctx.quadraticCurveTo(120, 8, 120, 8 + r);
    ctx.lineTo(120, 120 - r);
    ctx.quadraticCurveTo(120, 120, 120 - r, 120);
    ctx.lineTo(8 + r, 120);
    ctx.quadraticCurveTo(8, 120, 8, 120 - r);
    ctx.lineTo(8, 8 + r);
    ctx.quadraticCurveTo(8, 8, 8 + r, 8);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = 'destination-out';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const geom = new THREE.PlaneGeometry(8, 8);
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
  const {
    documentState,
    settings,
    isSelectingSupportPlane,
    setIsSelectingSupportPlane,
    addFeature,
    enterSketchEdit,
  } = useCad();
  const { features } = documentState;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.theme === 'light' ? '#f1f5f9' : '#0f172a');

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

    // Define capture handler outside to refer in cleanup
    let handlePointerCapture: ((e: PointerEvent | MouseEvent) => void) | undefined;

    if (settings.navigationStyle === 'blender') {
      controls.mouseButtons = {
        LEFT: undefined as unknown as THREE.MOUSE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: undefined as unknown as THREE.MOUSE,
      };

      // OrbitControls maps Ctrl+Rotate to PAN and Shift+Rotate to DOLLY.
      // Blender maps Shift+MiddleClick to PAN and Ctrl+MiddleClick to DOLLY (Zoom).
      // We swap the shiftKey and ctrlKey flags on Middle Click events so OrbitControls responds correctly.
      handlePointerCapture = (e: PointerEvent | MouseEvent) => {
        if (e.button === 1 || e.buttons === 4) {
          const hasShift = e.shiftKey;
          const hasCtrl = e.ctrlKey;
          Object.defineProperty(e, 'shiftKey', { get: () => hasCtrl, configurable: true });
          Object.defineProperty(e, 'ctrlKey', { get: () => hasShift, configurable: true });
        }
      };

      canvas.addEventListener('pointerdown', handlePointerCapture, true);
      canvas.addEventListener('pointermove', handlePointerCapture, true);
      canvas.addEventListener('pointerup', handlePointerCapture, true);
      canvas.addEventListener('mousedown', handlePointerCapture, true);
      canvas.addEventListener('mousemove', handlePointerCapture, true);
      canvas.addEventListener('mouseup', handlePointerCapture, true);
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }

    // 3. Dynamic Datum Features Rendering
    const datumGeometries: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

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
      const pointsX = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(settings.gridSize, 0, 0)];
      const geomX = new THREE.BufferGeometry().setFromPoints(pointsX);
      const matX = new THREE.LineBasicMaterial({ color: '#ef4444' }); // Red
      datumGeometries.push(geomX, matX);
      const lineX = new THREE.Line(geomX, matX);
      scene.add(lineX);
    }

    const axisYFeat = features.find((f) => f.id === 'datum_axis_y');
    if (axisYFeat && axisYFeat.params.visible !== false) {
      const pointsY = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, settings.gridSize, 0)];
      const geomY = new THREE.BufferGeometry().setFromPoints(pointsY);
      const matY = new THREE.LineBasicMaterial({ color: '#22c55e' }); // Green
      datumGeometries.push(geomY, matY);
      const lineY = new THREE.Line(geomY, matY);
      scene.add(lineY);
    }

    const axisZFeat = features.find((f) => f.id === 'datum_axis_z');
    if (axisZFeat && axisZFeat.params.visible !== false) {
      const pointsZ = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, settings.gridSize)];
      const geomZ = new THREE.BufferGeometry().setFromPoints(pointsZ);
      const matZ = new THREE.LineBasicMaterial({ color: '#3b82f6' }); // Blue
      datumGeometries.push(geomZ, matZ);
      const lineZ = new THREE.Line(geomZ, matZ);
      scene.add(lineZ);
    }

    const gridOffset = 2.0;
    const actualGridSize = Math.max(1, settings.gridSize - gridOffset);
    const actualGridDivisions = Math.max(
      1,
      Math.round(settings.gridDivisions * (actualGridSize / settings.gridSize)),
    );

    const planeXYFeat = features.find((f) => f.id === 'datum_plane_xy');

    if (planeXYFeat && planeXYFeat.params.visible !== false) {
      const xyGrid = new THREE.GridHelper(
        actualGridSize,
        actualGridDivisions,
        '#475569',
        '#1e293b',
      );
      xyGrid.geometry?.translate(
        actualGridSize / 2 + gridOffset,
        0,
        -(actualGridSize / 2 + gridOffset),
      );
      xyGrid.rotation.x = Math.PI / 2;
      xyGrid.position.z = -0.01;
      scene.add(xyGrid);

      const label = createPlaneMeshLabel('XY', '#ef4444');
      label.position.set(settings.gridSize - 4.0, settings.gridSize - 4.0, 0.01);
      scene.add(label);

      const mat = label.material as THREE.MeshBasicMaterial;
      datumGeometries.push(
        xyGrid.geometry,
        xyGrid.material as THREE.Material,
        label.geometry,
        mat,
        mat.map!,
      );
    }

    const planeYZFeat = features.find((f) => f.id === 'datum_plane_yz');
    if (planeYZFeat && planeYZFeat.params.visible !== false) {
      const yzGrid = new THREE.GridHelper(
        actualGridSize,
        actualGridDivisions,
        '#475569',
        '#1e293b',
      );
      yzGrid.geometry?.translate(
        actualGridSize / 2 + gridOffset,
        0,
        actualGridSize / 2 + gridOffset,
      );
      yzGrid.rotation.z = Math.PI / 2;
      yzGrid.position.x = -0.01;
      scene.add(yzGrid);

      const label = createPlaneMeshLabel('YZ', '#22c55e');
      label.position.set(0.01, settings.gridSize - 4.0, settings.gridSize - 4.0);
      label.rotation.y = Math.PI / 2;
      scene.add(label);

      const mat = label.material as THREE.MeshBasicMaterial;
      datumGeometries.push(
        yzGrid.geometry,
        yzGrid.material as THREE.Material,
        label.geometry,
        mat,
        mat.map!,
      );
    }

    const planeZXFeat = features.find((f) => f.id === 'datum_plane_zx');
    if (planeZXFeat && planeZXFeat.params.visible !== false) {
      const zxGrid = new THREE.GridHelper(
        actualGridSize,
        actualGridDivisions,
        '#475569',
        '#1e293b',
      );
      zxGrid.geometry?.translate(
        actualGridSize / 2 + gridOffset,
        0,
        actualGridSize / 2 + gridOffset,
      );
      zxGrid.position.y = -0.01;
      scene.add(zxGrid);

      const label = createPlaneMeshLabel('ZX', '#3b82f6');
      label.position.set(settings.gridSize - 4.0, 0.01, settings.gridSize - 4.0);
      label.rotation.x = Math.PI / 2;
      scene.add(label);

      const mat = label.material as THREE.MeshBasicMaterial;
      datumGeometries.push(
        zxGrid.geometry,
        zxGrid.material as THREE.Material,
        label.geometry,
        mat,
        mat.map!,
      );
    }

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight('#ffffff', '#444444', 1.5);
    hemiLight.position.set(0, 0, 100);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.0);
    dirLight.position.set(50, 50, 100);
    scene.add(dirLight);

    // 5. Evaluate features in Web Worker (with synchronous fallback)
    let worker: Worker | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.MeshStandardMaterial | null = null;
    let wireframeGeom: THREE.EdgesGeometry | null = null;
    let wireframeMat: THREE.LineBasicMaterial | null = null;
    let activeMesh: THREE.Mesh | null = null;
    let activeLine: THREE.LineSegments | null = null;

    const updateSceneGeometry = (
      positions: Float32Array,
      normals: Float32Array,
      linePositions: Float32Array,
    ) => {
      if (positions.length > 0) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

        material = new THREE.MeshStandardMaterial({
          color: '#38bdf8', // beautiful light blue
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9,
        });
        activeMesh = new THREE.Mesh(geometry, material);
        scene.add(activeMesh);

        // Wireframe edges overlay
        wireframeGeom = new THREE.EdgesGeometry(geometry);
        wireframeMat = new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 1.5 });
        const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
        activeMesh.add(wireframe);
      } else if (linePositions.length > 0) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: '#f59e0b', linewidth: 2.0 });
        activeLine = new THREE.LineSegments(geometry, lineMat);
        scene.add(activeLine);
      }
    };

    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL('../core/cad.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        const response = e.data;
        if (response.type === 'BUILD_SOLID_SUCCESS') {
          const { positions, normals, linePositions } = response;
          updateSceneGeometry(positions, normals, linePositions);
        }
      };
      worker.postMessage({ type: 'BUILD_SOLID', features });
    } else {
      try {
        const solid = buildSolidFromFeatures(features);
        if (solid && solid.vertices.length > 0) {
          if (solid.faces.length > 0) {
            const tempGeom = buildThreeGeometry(solid);
            const positionsAttr = tempGeom.getAttribute('position') as THREE.BufferAttribute;
            const normalsAttr = tempGeom.getAttribute('normal') as THREE.BufferAttribute;
            const positions = positionsAttr
              ? (positionsAttr.array as Float32Array)
              : new Float32Array(0);
            const normals = normalsAttr ? (normalsAttr.array as Float32Array) : new Float32Array(0);
            updateSceneGeometry(positions, normals, new Float32Array(0));
            tempGeom.dispose();
          } else {
            const linePositions: number[] = [];
            for (const edge of solid.edges) {
              const vStart = solid.vertices.find((v) => v.id === edge.startVertexId);
              const vEnd = solid.vertices.find((v) => v.id === edge.endVertexId);
              if (vStart && vEnd) {
                linePositions.push(vStart.x, vStart.y, vStart.z);
                linePositions.push(vEnd.x, vEnd.y, vEnd.z);
              }
            }
            updateSceneGeometry(
              new Float32Array(0),
              new Float32Array(0),
              new Float32Array(linePositions),
            );
          }
        }
      } catch (err) {
        console.error('Error rebuilding solid synchronously:', err);
      }
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
      if (worker) {
        worker.terminate();
      }
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      geometry?.dispose();
      material?.dispose();
      wireframeGeom?.dispose();
      wireframeMat?.dispose();
      if (activeMesh) {
        scene.remove(activeMesh);
      }
      if (activeLine) {
        scene.remove(activeLine);
      }
      datumGeometries.forEach((d) => d?.dispose?.());
      if (handlePointerCapture) {
        canvas.removeEventListener('pointerdown', handlePointerCapture, true);
        canvas.removeEventListener('pointermove', handlePointerCapture, true);
        canvas.removeEventListener('pointerup', handlePointerCapture, true);
        canvas.removeEventListener('mousedown', handlePointerCapture, true);
        canvas.removeEventListener('mousemove', handlePointerCapture, true);
        canvas.removeEventListener('mouseup', handlePointerCapture, true);
      }
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
      {isSelectingSupportPlane && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--cad-color-surface-secondary)',
            border: '1px solid var(--cad-glass-border-base)',
            borderRadius: 'var(--cad-radius-md)',
            padding: '16px 24px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            boxShadow: 'var(--cad-shadow-lg)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              color: 'var(--cad-color-text-primary)',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            Select a support plane for the sketch
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                const count =
                  features.filter((f) => f.type === 'sketch' && !f.params.isDatum).length + 1;
                const newSketchId = addFeature(
                  'sketch',
                  `Sketch ${count}`,
                  { supportPlaneId: 'datum_plane_xy', geometries: [], constraints: [] },
                  ['datum_plane_xy'],
                );
                setIsSelectingSupportPlane(false);
                enterSketchEdit(newSketchId);
              }}
              className="toolbar-btn primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              XY Plane
            </button>
            <button
              onClick={() => {
                const count =
                  features.filter((f) => f.type === 'sketch' && !f.params.isDatum).length + 1;
                const newSketchId = addFeature(
                  'sketch',
                  `Sketch ${count}`,
                  { supportPlaneId: 'datum_plane_yz', geometries: [], constraints: [] },
                  ['datum_plane_yz'],
                );
                setIsSelectingSupportPlane(false);
                enterSketchEdit(newSketchId);
              }}
              className="toolbar-btn primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              YZ Plane
            </button>
            <button
              onClick={() => {
                const count =
                  features.filter((f) => f.type === 'sketch' && !f.params.isDatum).length + 1;
                const newSketchId = addFeature(
                  'sketch',
                  `Sketch ${count}`,
                  { supportPlaneId: 'datum_plane_zx', geometries: [], constraints: [] },
                  ['datum_plane_zx'],
                );
                setIsSelectingSupportPlane(false);
                enterSketchEdit(newSketchId);
              }}
              className="toolbar-btn primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              ZX Plane
            </button>
            <button
              onClick={() => setIsSelectingSupportPlane(false)}
              className="toolbar-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                border: '1px solid var(--cad-color-brand-danger)',
                color: 'var(--cad-color-brand-danger)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
