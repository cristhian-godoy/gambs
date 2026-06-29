import { type ReactNode } from 'react';

/**
 * Main Viewport component displaying the CAD drawing/canvas workspace.
 * @returns The rendered Viewport component.
 */
export default function Viewport(): ReactNode {
  return (
    <div className="viewport-area">
      <div className="viewport-grid" />
      <div className="viewport-axes">
        <div className="axis-x" />
        <div className="axis-y" />
      </div>
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
        X: 0.00 | Y: 0.00 mm
      </div>
    </div>
  );
}
