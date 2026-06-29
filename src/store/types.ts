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
  | 'intersection';

/**
 * Representation of a single parametric CAD feature.
 */
export interface Feature {
  id: string;
  type: FeatureType;
  name: string;
  params: Record<string, unknown>;
  dependencies: string[];
}

/**
 * Represents the state of the active CAD document.
 */
export interface DocumentState {
  features: Feature[];
  activeFeatureId: string | null;
}
