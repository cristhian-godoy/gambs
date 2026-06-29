import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Performant 2D sketch canvas with pan and zoom capabilities.
 * @returns The rendered SketchCanvas component.
 */
export default function SketchCanvas(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transforms stored in refs for 60fps rendering without React bottleneck
  const transformRef = useRef({
    zoom: 1.0,
    offsetX: 0,
    offsetY: 0,
  });

  const isPanningRef = useRef(false);
  const startDragRef = useRef({ x: 0, y: 0 });

  // Expose viewport coordinates to UI
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Convert screen coordinates to world (sketch) coordinates
    const screenToWorld = (screenX: number, screenY: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (screenX - rect.left - offsetX) / zoom;
      const y = -(screenY - rect.top - offsetY) / zoom; // invert Y for standard Cartesian coordinates
      return { x, y };
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const { zoom, offsetX, offsetY } = transformRef.current;

      ctx.clearRect(0, 0, width, height);

      // Apply viewport transform
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, -zoom); // Invert Y axis for positive Y going up

      // Calculate grid spacing based on zoom
      // We want spacing to be around 20-100 pixels in screen space
      let gridSpacing = 10; // 10mm
      const minPixelSpacing = 30;

      while (gridSpacing * zoom < minPixelSpacing) {
        gridSpacing *= 5; // step up spacing
      }
      while (gridSpacing * zoom > minPixelSpacing * 5) {
        gridSpacing /= 2; // step down spacing
      }

      // Determine grid bounds in world coordinates
      const leftWorld = -offsetX / zoom;
      const rightWorld = (width - offsetX) / zoom;
      const topWorld = offsetY / zoom;
      const bottomWorld = -(height - offsetY) / zoom;

      // Start drawing grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1 / zoom;

      const startX = Math.floor(leftWorld / gridSpacing) * gridSpacing;
      const endX = Math.ceil(rightWorld / gridSpacing) * gridSpacing;
      for (let x = startX; x <= endX; x += gridSpacing) {
        if (Math.abs(x) < 0.001) continue; // skip axes
        ctx.beginPath();
        ctx.moveTo(x, bottomWorld);
        ctx.lineTo(x, topWorld);
        ctx.stroke();
      }

      const startY = Math.floor(bottomWorld / gridSpacing) * gridSpacing;
      const endY = Math.ceil(topWorld / gridSpacing) * gridSpacing;
      for (let y = startY; y <= endY; y += gridSpacing) {
        if (Math.abs(y) < 0.001) continue; // skip axes
        ctx.beginPath();
        ctx.moveTo(leftWorld, y);
        ctx.lineTo(rightWorld, y);
        ctx.stroke();
      }

      // Draw Major Axes
      // X axis (Red)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(leftWorld, 0);
      ctx.lineTo(rightWorld, 0);
      ctx.stroke();

      // Y axis (Green)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, bottomWorld);
      ctx.lineTo(0, topWorld);
      ctx.stroke();

      // Draw Origin point
      ctx.fillStyle = 'var(--cad-color-brand-main)';
      ctx.beginPath();
      ctx.arc(0, 0, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const requestRedraw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawGrid(ctx, canvas.width, canvas.height);
    };

    // Set initial offset to center of screen
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    transformRef.current.offsetX = rect.width / 2;
    transformRef.current.offsetY = rect.height / 2;

    requestRedraw();

    // Resize handler
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        requestRedraw();
      }
    });
    resizeObserver.observe(container);

    // Mouse events for pan & zoom
    const handleMouseDown = (e: MouseEvent) => {
      // Pan on middle mouse click or space+left click
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanningRef.current = true;
        startDragRef.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Update coordinate indicator
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setCoords({ x: worldPos.x, y: worldPos.y });

      if (isPanningRef.current) {
        const dx = e.clientX - startDragRef.current.x;
        const dy = e.clientY - startDragRef.current.y;
        transformRef.current.offsetX += dx;
        transformRef.current.offsetY += dy;
        startDragRef.current = { x: e.clientX, y: e.clientY };
        requestRedraw();
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.style.cursor = 'default';
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const { zoom, offsetX, offsetY } = transformRef.current;

      const mouseRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - mouseRect.left;
      const mouseY = e.clientY - mouseRect.top;

      // Mouse pos in world coordinates before zoom
      const worldX = (mouseX - offsetX) / zoom;
      const worldY = -(mouseY - offsetY) / zoom;

      let newZoom = zoom;
      if (e.deltaY < 0) {
        newZoom *= zoomFactor;
      } else {
        newZoom /= zoomFactor;
      }

      // Constrain zoom levels
      newZoom = Math.max(0.1, Math.min(newZoom, 50));

      // Calculate new offsets to keep mouse position stable
      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY + worldY * newZoom;

      transformRef.current.zoom = newZoom;
      transformRef.current.offsetX = newOffsetX;
      transformRef.current.offsetY = newOffsetY;

      requestRedraw();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div ref={containerRef} className="viewport-area">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'var(--cad-glass-bg-base)',
          border: '1px solid var(--cad-glass-border-base)',
          borderRadius: 'var(--cad-radius-sm)',
          padding: '6px 10px',
          fontSize: '0.75rem',
          color: 'var(--cad-color-text-secondary)',
          pointerEvents: 'none',
        }}
      >
        X: {coords.x.toFixed(2)} | Y: {coords.y.toFixed(2)} mm
      </div>
    </div>
  );
}
