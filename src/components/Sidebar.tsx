import { ChevronLeft, ChevronRight, FolderTree } from 'lucide-react';
import { type ReactNode } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

/**
 * Sidebar component housing the feature tree and properties panel.
 * @param props Props for the sidebar component.
 * @returns The rendered Sidebar component.
 */
export default function Sidebar({ isOpen, onToggle, children }: SidebarProps): ReactNode {
  return (
    <>
      <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Feature Tree</span>
          <FolderTree size={16} style={{ color: 'var(--cad-color-text-secondary)' }} />
        </div>
        <div className="sidebar-content">
          {children || (
            <div style={{ color: 'var(--cad-color-text-muted)', fontSize: '0.875rem' }}>
              No features created yet.
            </div>
          )}
        </div>
      </aside>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        aria-label={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </>
  );
}
