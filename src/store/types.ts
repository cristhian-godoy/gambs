import type { Arc2D, Circle2D, Line2D, Rect2D } from '../core/geometry.ts';

/**
 * Types of features supported in the CAD parametric model.
 */
export type FeatureType =
  | 'sketch'
  | 'pad'
  | 'pocket'
  | 'revolution'
  | 'groove'
  | 'loft'
  | 'pipe'
  | 'helix'
  | 'fillet'
  | 'chamfer'
  | 'draft'
  | 'thickness'
  | 'hole'
  | 'linear_pattern'
  | 'polar_pattern'
  | 'mirror'
  | 'union'
  | 'difference'
  | 'intersection'
  | 'part'
  | 'body';

/**
 * Discrimination structure for geometries in a sketch.
 */
export type SketchGeometry = (
  | ({ type: 'line' } & Line2D)
  | ({ type: 'circle' } & Circle2D)
  | ({ type: 'arc' } & Arc2D)
  | ({ type: 'rect' } & Rect2D)
) & { isConstruction?: boolean };

/**
 * Representation of a single parametric CAD feature.
 */
export interface Feature {
  id: string;
  type: FeatureType;
  name: string;
  params: Record<string, unknown>;
  dependencies: string[];
  parentId?: string;
}

/**
 * Represents the state of the active CAD document.
 */
export interface DocumentState {
  features: Feature[];
  activeFeatureId: string | null;
  activeSketchId: string | null;
  activeBodyId?: string | null;
  activePartId?: string | null;
}
