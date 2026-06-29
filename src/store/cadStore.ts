import { DocumentState, Feature, SketchGeometry } from './types.ts';

/**
 * State representing the history of the document.
 */
export interface CadHistoryState {
  past: DocumentState[];
  present: DocumentState;
  future: DocumentState[];
}

/**
 * Action types for CAD state transitions.
 */
export type CadAction =
  | { type: 'ADD_FEATURE'; feature: Feature }
  | { type: 'UPDATE_FEATURE'; id: string; params: Record<string, unknown> }
  | { type: 'DELETE_FEATURE'; id: string }
  | { type: 'SET_ACTIVE_FEATURE'; id: string | null }
  | { type: 'ENTER_SKETCH_EDIT'; id: string }
  | { type: 'EXIT_SKETCH_EDIT' }
  | { type: 'ADD_SKETCH_GEOMETRY'; geometry: SketchGeometry }
  | { type: 'DELETE_SKETCH_GEOMETRY'; geometryId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export const initialDocumentState: DocumentState = {
  features: [],
  activeFeatureId: null,
  activeSketchId: null,
};

export const initialHistoryState: CadHistoryState = {
  past: [],
  present: initialDocumentState,
  future: [],
};

/**
 * Reducer function for CAD document state and history.
 * @param state The current history state.
 * @param action The action to apply.
 * @returns The new history state.
 */
export function cadReducer(state: CadHistoryState, action: CadAction): CadHistoryState {
  const { past, present, future } = state;

  switch (action.type) {
    case 'ADD_FEATURE': {
      let newFeatures = [...present.features];
      if (present.activeFeatureId !== null) {
        const activeIdx = newFeatures.findIndex((f) => f.id === present.activeFeatureId);
        if (activeIdx !== -1) {
          // Truncate features after the active pointer (standard rollback insertion behavior)
          newFeatures = newFeatures.slice(0, activeIdx + 1);
        }
      }

      newFeatures.push(action.feature);

      const nextPresent: DocumentState = {
        ...present,
        features: newFeatures,
        activeFeatureId: action.feature.id,
      };

      return {
        past: [...past, present],
        present: nextPresent,
        future: [],
      };
    }

    case 'UPDATE_FEATURE': {
      const nextFeatures = present.features.map((f) => {
        if (f.id === action.id) {
          return {
            ...f,
            params: { ...f.params, ...action.params },
          };
        }
        return f;
      });

      const nextPresent: DocumentState = {
        ...present,
        features: nextFeatures,
      };

      return {
        past: [...past, present],
        present: nextPresent,
        future: [],
      };
    }

    case 'DELETE_FEATURE': {
      // Find feature index
      const targetIdx = present.features.findIndex((f) => f.id === action.id);
      if (targetIdx === -1) {
        return state;
      }

      // Identify dependencies recursively or simple cascading delete of all subsequent features
      // In parametric design, features after the deleted one that depend on it are broken.
      // For simplicity, we remove the target feature and any features after it that have it in dependencies.
      const deletedIds = new Set<string>([action.id]);
      const nextFeatures: Feature[] = [];

      for (const f of present.features) {
        if (f.id === action.id) {
          continue;
        }
        const hasDependency = f.dependencies.some((depId) => deletedIds.has(depId));
        if (hasDependency) {
          deletedIds.add(f.id);
        } else {
          nextFeatures.push(f);
        }
      }

      let nextActiveId = present.activeFeatureId;
      if (nextActiveId && deletedIds.has(nextActiveId)) {
        // Fallback to the last remaining feature before the deleted one, or null
        const lastRemaining = nextFeatures[nextFeatures.length - 1];
        nextActiveId = lastRemaining ? lastRemaining.id : null;
      }

      const nextPresent: DocumentState = {
        ...present,
        features: nextFeatures,
        activeFeatureId: nextActiveId,
        activeSketchId: present.activeSketchId === action.id ? null : present.activeSketchId,
      };

      return {
        past: [...past, present],
        present: nextPresent,
        future: [],
      };
    }

    case 'SET_ACTIVE_FEATURE': {
      // Validates if the feature exists, or is null
      if (action.id !== null && !present.features.some((f) => f.id === action.id)) {
        return state;
      }
      return {
        ...state,
        present: {
          ...present,
          activeFeatureId: action.id,
        },
      };
    }

    case 'ENTER_SKETCH_EDIT': {
      return {
        ...state,
        present: {
          ...present,
          activeSketchId: action.id,
        },
      };
    }

    case 'EXIT_SKETCH_EDIT': {
      return {
        ...state,
        present: {
          ...present,
          activeSketchId: null,
        },
      };
    }

    case 'ADD_SKETCH_GEOMETRY': {
      if (!present.activeSketchId) {
        return state;
      }

      const nextFeatures = present.features.map((f) => {
        if (f.id === present.activeSketchId) {
          const currentGeometries = (f.params.geometries as SketchGeometry[]) || [];
          return {
            ...f,
            params: {
              ...f.params,
              geometries: [...currentGeometries, action.geometry],
            },
          };
        }
        return f;
      });

      const nextPresent: DocumentState = {
        ...present,
        features: nextFeatures,
      };

      return {
        past: [...past, present],
        present: nextPresent,
        future: [],
      };
    }

    case 'DELETE_SKETCH_GEOMETRY': {
      if (!present.activeSketchId) {
        return state;
      }

      const nextFeatures = present.features.map((f) => {
        if (f.id === present.activeSketchId) {
          const currentGeometries = (f.params.geometries as SketchGeometry[]) || [];
          return {
            ...f,
            params: {
              ...f.params,
              geometries: currentGeometries.filter((g) => g.id !== action.geometryId),
            },
          };
        }
        return f;
      });

      const nextPresent: DocumentState = {
        ...present,
        features: nextFeatures,
      };

      return {
        past: [...past, present],
        present: nextPresent,
        future: [],
      };
    }

    case 'UNDO': {
      if (past.length === 0) {
        return state;
      }
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    }

    case 'REDO': {
      if (future.length === 0) {
        return state;
      }
      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    }

    default:
      return state;
  }
}
