import {
  AlignJustify,
  Circle,
  CircleDot,
  Compass,
  CornerDownRight,
  Lock,
  MoveRight,
  MoveUp,
  Ruler,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface ConstraintsMenuProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  canHorizontal: boolean;
  canVertical: boolean;
  canParallel: boolean;
  canPerpendicular: boolean;
  canTangent: boolean;
  canFixed: boolean;
  canRadius: boolean;
  canAngle: boolean;
  applyHorizontal: () => void;
  applyVertical: () => void;
  applyParallel: () => void;
  applyPerpendicular: () => void;
  applyTangent: () => void;
  applyFixed: () => void;
  applyRadius: () => void;
  applyAngle: () => void;
}

/**
 * Renders the advanced Constraints dropdown menu.
 * @returns The rendered ConstraintsMenu component.
 */
export default function ConstraintsMenu({
  isOpen,
  onToggle,
  onClose,
  canHorizontal,
  canVertical,
  canParallel,
  canPerpendicular,
  canTangent,
  canFixed,
  canRadius,
  canAngle,
  applyHorizontal,
  applyVertical,
  applyParallel,
  applyPerpendicular,
  applyTangent,
  applyFixed,
  applyRadius,
  applyAngle,
}: ConstraintsMenuProps): ReactNode {
  return (
    <div className="constraints-menu-container" style={{ position: 'relative' }}>
      <button className="toolbar-btn" onClick={onToggle} title="Constraints Menu">
        <Ruler size={16} /> More Constraints
      </button>

      {isOpen && (
        <div
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            backgroundColor: 'var(--cad-color-surface-elevated)',
            border: '1px solid var(--cad-glass-border-base)',
            borderRadius: 'var(--cad-radius-md)',
            boxShadow: 'var(--cad-shadow-glow)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            minWidth: '180px',
            padding: '4px 0',
            marginTop: '4px',
          }}
        >
          <button
            className="dropdown-item"
            onClick={() => {
              applyHorizontal();
              onClose();
            }}
            disabled={!canHorizontal}
            title="Horizontal Constraint (Select 1 line)"
            style={{ opacity: canHorizontal ? 1 : 0.4 }}
          >
            <MoveRight size={14} /> Horizontal
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyVertical();
              onClose();
            }}
            disabled={!canVertical}
            title="Vertical Constraint (Select 1 line)"
            style={{ opacity: canVertical ? 1 : 0.4 }}
          >
            <MoveUp size={14} /> Vertical
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyParallel();
              onClose();
            }}
            disabled={!canParallel}
            title="Parallel Constraint (Select 2 lines)"
            style={{ opacity: canParallel ? 1 : 0.4 }}
          >
            <AlignJustify size={14} /> Parallel
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyPerpendicular();
              onClose();
            }}
            disabled={!canPerpendicular}
            title="Perpendicular Constraint (Select 2 lines)"
            style={{ opacity: canPerpendicular ? 1 : 0.4 }}
          >
            <CornerDownRight size={14} /> Perpendicular
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyTangent();
              onClose();
            }}
            disabled={!canTangent}
            title="Tangent Constraint (Select Line + Circle or 2 Circles)"
            style={{ opacity: canTangent ? 1 : 0.4 }}
          >
            <CircleDot size={14} /> Tangent
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyFixed();
              onClose();
            }}
            disabled={!canFixed}
            title="Fixed Constraint (Select 1 point)"
            style={{ opacity: canFixed ? 1 : 0.4 }}
          >
            <Lock size={14} /> Fix
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyRadius();
              onClose();
            }}
            disabled={!canRadius}
            title="Radius Constraint (Select 1 circle)"
            style={{ opacity: canRadius ? 1 : 0.4 }}
          >
            <Circle size={14} /> Radius
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              applyAngle();
              onClose();
            }}
            disabled={!canAngle}
            title="Angle Constraint (Select 2 lines)"
            style={{ opacity: canAngle ? 1 : 0.4 }}
          >
            <Compass size={14} /> Angle
          </button>
        </div>
      )}
    </div>
  );
}
