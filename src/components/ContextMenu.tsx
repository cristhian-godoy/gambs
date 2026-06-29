import { type ReactNode, useEffect } from 'react';

import { useCad } from '../store/CadContext.tsx';

/**
 * Floating Context Menu component that renders on right-click.
 * @returns The rendered ContextMenu component or null.
 */
export default function ContextMenu(): ReactNode {
  const { contextMenu, closeContextMenu } = useCad();

  useEffect(() => {
    if (!contextMenu) return;

    const handleClose = () => {
      closeContextMenu();
    };

    const timeout = setTimeout(() => {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
    }, 0);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  return (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        backgroundColor: 'var(--cad-color-surface-elevated)',
        border: '1px solid var(--cad-glass-border-base)',
        borderRadius: 'var(--cad-radius-md)',
        boxShadow: 'var(--cad-shadow-glow)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        minWidth: '150px',
        padding: '4px 0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.options.map((opt, idx) => (
        <button
          key={idx}
          className="dropdown-item"
          onClick={() => {
            opt.action();
            closeContextMenu();
          }}
          style={{
            fontSize: '0.8rem',
            padding: '8px 12px',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
