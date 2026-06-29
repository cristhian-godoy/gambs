import { type ReactNode } from 'react';

/**
 * Main application component.
 * @returns The rendered application.
 */
export default function App(): ReactNode {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1>SPA CAD</h1>
    </div>
  );
}
