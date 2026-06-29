import { type SketchConstraint, solveSketch } from '../core/solver.ts';
import type { DocumentState, Feature, SketchGeometry } from './types.ts';

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
  | { type: 'SET_ACTIVE_BODY'; id: string | null }
  | { type: 'SET_ACTIVE_PART'; id: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET_DOCUMENT' }
  | { type: 'LOAD_DOCUMENT'; document: DocumentState };

export const initialDocumentState: DocumentState = {
  features: [
    {
      id: 'datum_origin',
      type: 'sketch',
      name: 'Canvas Origin',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
    {
      id: 'datum_axis_x',
      type: 'sketch',
      name: 'X Axis',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
    {
      id: 'datum_axis_y',
      type: 'sketch',
      name: 'Y Axis',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
    {
      id: 'datum_axis_z',
      type: 'sketch',
      name: 'Z Axis',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
    {
      id: 'datum_plane_xy',
      type: 'sketch',
      name: 'XY Plane',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
    {
      id: 'datum_plane_yz',
      type: 'sketch',
      name: 'YZ Plane',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
    {
      id: 'datum_plane_zx',
      type: 'sketch',
      name: 'ZX Plane',
      params: { visible: true, isDatum: true, geometries: [], constraints: [] },
      dependencies: [],
    },
  ],
  activeFeatureId: null,
  activeSketchId: null,
  activeBodyId: null,
  activePartId: null,
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

      // If activeBodyId is present, auto-nest the feature under it (unless it's a part/body/datum)
      const targetFeature = { ...action.feature };
      if (
        targetFeature.type !== 'body' &&
        targetFeature.type !== 'part' &&
        targetFeature.params.isDatum !== true &&
        !targetFeature.parentId &&
        present.activeBodyId
      ) {
        targetFeature.parentId = present.activeBodyId;
      }

      // If a body is being added, auto-nest under activePartId
      if (targetFeature.type === 'body' && !targetFeature.parentId && present.activePartId) {
        targetFeature.parentId = present.activePartId;
      }

      newFeatures.push(targetFeature);

      let nextActiveId = targetFeature.id;
      let nextActiveBodyId = present.activeBodyId;
      let nextActivePartId = present.activePartId;

      if (targetFeature.type === 'body') {
        const bodyId = targetFeature.id;
        nextActiveBodyId = bodyId;

        // Create local origin datums
        const localOriginPoint: Feature = {
          id: `datum_origin_${bodyId}`,
          type: 'sketch',
          name: 'Origin',
          parentId: bodyId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };
        const localAxisX: Feature = {
          id: `datum_axis_x_${bodyId}`,
          type: 'sketch',
          name: 'X Axis',
          parentId: bodyId,
          params: { isDatum: true, visible: false },
          dependencies: [],
        };
        const localAxisY: Feature = {
          id: `datum_axis_y_${bodyId}`,
          type: 'sketch',
          name: 'Y Axis',
          parentId: bodyId,
          params: { isDatum: true, visible: false },
          dependencies: [],
        };
        const localAxisZ: Feature = {
          id: `datum_axis_z_${bodyId}`,
          type: 'sketch',
          name: 'Z Axis',
          parentId: bodyId,
          params: { isDatum: true, visible: false },
          dependencies: [],
        };
        const localPlaneXY: Feature = {
          id: `datum_plane_xy_${bodyId}`,
          type: 'sketch',
          name: 'XY Plane',
          parentId: bodyId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };
        const localPlaneYZ: Feature = {
          id: `datum_plane_yz_${bodyId}`,
          type: 'sketch',
          name: 'YZ Plane',
          parentId: bodyId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };
        const localPlaneZX: Feature = {
          id: `datum_plane_zx_${bodyId}`,
          type: 'sketch',
          name: 'ZX Plane',
          parentId: bodyId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };

        newFeatures.push(
          localOriginPoint,
          localAxisX,
          localAxisY,
          localAxisZ,
          localPlaneXY,
          localPlaneYZ,
          localPlaneZX,
        );
        nextActiveId = localPlaneZX.id;
      } else if (targetFeature.type === 'part') {
        const partId = targetFeature.id;

        // Create local origin datums
        const localOriginPoint: Feature = {
          id: `datum_origin_${partId}`,
          type: 'sketch',
          name: 'Origin',
          parentId: partId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };
        const localAxisX: Feature = {
          id: `datum_axis_x_${partId}`,
          type: 'sketch',
          name: 'X Axis',
          parentId: partId,
          params: { isDatum: true, visible: false },
          dependencies: [],
        };
        const localAxisY: Feature = {
          id: `datum_axis_y_${partId}`,
          type: 'sketch',
          name: 'Y Axis',
          parentId: partId,
          params: { isDatum: true, visible: false },
          dependencies: [],
        };
        const localAxisZ: Feature = {
          id: `datum_axis_z_${partId}`,
          type: 'sketch',
          name: 'Z Axis',
          parentId: partId,
          params: { isDatum: true, visible: false },
          dependencies: [],
        };
        const localPlaneXY: Feature = {
          id: `datum_plane_xy_${partId}`,
          type: 'sketch',
          name: 'XY Plane',
          parentId: partId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };
        const localPlaneYZ: Feature = {
          id: `datum_plane_yz_${partId}`,
          type: 'sketch',
          name: 'YZ Plane',
          parentId: partId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };
        const localPlaneZX: Feature = {
          id: `datum_plane_zx_${partId}`,
          type: 'sketch',
          name: 'ZX Plane',
          parentId: partId,
          params: { isDatum: true, visible: true },
          dependencies: [],
        };

        newFeatures.push(
          localOriginPoint,
          localAxisX,
          localAxisY,
          localAxisZ,
          localPlaneXY,
          localPlaneYZ,
          localPlaneZX,
        );
        nextActiveId = localPlaneZX.id;
        nextActivePartId = partId;
      }

      const nextPresent: DocumentState = {
        ...present,
        features: newFeatures,
        activeFeatureId: nextActiveId,
        activeBodyId: nextActiveBodyId,
        activePartId: nextActivePartId,
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
          const { name, parentId, ...otherParams } = action.params;
          const combinedParams = { ...f.params, ...otherParams };
          if (f.type === 'sketch') {
            const geometries = (combinedParams.geometries as SketchGeometry[]) || [];
            const constraints = (combinedParams.constraints as SketchConstraint[]) || [];
            const {
              geometries: solvedGeometries,
              dof,
              converged,
            } = solveSketch(geometries, constraints);
            combinedParams.geometries = solvedGeometries;
            combinedParams.dof = dof;
            combinedParams.converged = converged;
          }
          return {
            ...f,
            name: name !== undefined ? (name as string) : f.name,
            parentId:
              parentId !== undefined
                ? parentId === null
                  ? undefined
                  : (parentId as string)
                : f.parentId,
            params: combinedParams,
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
      // For simplicity, we remove the target feature, any child features, and any features after it that have it in dependencies.
      const deletedIds = new Set<string>([action.id]);
      const nextFeatures: Feature[] = [];

      for (const f of present.features) {
        if (f.id === action.id) {
          continue;
        }
        const isChild = f.parentId && deletedIds.has(f.parentId);
        const hasDependency = f.dependencies.some((depId) => deletedIds.has(depId));
        if (isChild || hasDependency) {
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
        activeBodyId:
          present.activeBodyId && deletedIds.has(present.activeBodyId)
            ? null
            : present.activeBodyId,
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

    case 'SET_ACTIVE_BODY': {
      if (action.id !== null && !present.features.some((f) => f.id === action.id)) {
        return state;
      }
      return {
        ...state,
        present: {
          ...present,
          activeBodyId: action.id,
        },
      };
    }

    case 'SET_ACTIVE_PART': {
      if (action.id !== null && !present.features.some((f) => f.id === action.id)) {
        return state;
      }
      return {
        ...state,
        present: {
          ...present,
          activePartId: action.id,
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
          const constraints = (f.params.constraints as SketchConstraint[]) || [];
          const newGeometries = [...currentGeometries, action.geometry];
          const {
            geometries: solvedGeometries,
            dof,
            converged,
          } = solveSketch(newGeometries, constraints);
          return {
            ...f,
            params: {
              ...f.params,
              geometries: solvedGeometries,
              dof,
              converged,
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
          const nextGeoms = currentGeometries.filter((g) => g.id !== action.geometryId);
          const currentConstraints = (f.params.constraints as SketchConstraint[]) || [];
          const nextConstraints = currentConstraints.filter((c) =>
            c.targets.every(
              (t) =>
                nextGeoms.some((g) => g.id === t.geomId) ||
                t.geomId === 'datum_origin' ||
                t.geomId.startsWith('datum_axis_'),
            ),
          );
          const {
            geometries: solvedGeometries,
            dof,
            converged,
          } = solveSketch(nextGeoms, nextConstraints);
          return {
            ...f,
            params: {
              ...f.params,
              geometries: solvedGeometries,
              constraints: nextConstraints,
              dof,
              converged,
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

    case 'RESET_DOCUMENT': {
      return {
        past: [...past, present],
        present: initialDocumentState,
        future: [],
      };
    }

    case 'LOAD_DOCUMENT': {
      return {
        past: [...past, present],
        present: action.document,
        future: [],
      };
    }

    default:
      return state;
  }
}
