/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useContext, useReducer } from 'react';

import { cadReducer, initialHistoryState } from './cadStore.ts';
import { DocumentState, Feature, FeatureType } from './types.ts';

interface CadContextType {
  documentState: DocumentState;
  canUndo: boolean;
  canRedo: boolean;
  addFeature: (
    type: FeatureType,
    name: string,
    params?: Record<string, unknown>,
    dependencies?: string[],
  ) => void;
  updateFeature: (id: string, params: Record<string, unknown>) => void;
  deleteFeature: (id: string) => void;
  setActiveFeature: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
}

const CadContext = createContext<CadContextType | undefined>(undefined);

/**
 * Context Provider component for managing CAD document state.
 * @param props Props containing children node.
 * @returns The rendered CadProvider component.
 */
export function CadProvider({ children }: { children: ReactNode }): ReactNode {
  const [history, dispatch] = useReducer(cadReducer, initialHistoryState);

  const addFeature = (
    type: FeatureType,
    name: string,
    params: Record<string, unknown> = {},
    dependencies: string[] = [],
  ) => {
    const id = `${type}_${Date.now()}`;
    const feature: Feature = { id, type, name, params, dependencies };
    dispatch({ type: 'ADD_FEATURE', feature });
  };

  const updateFeature = (id: string, params: Record<string, unknown>) => {
    dispatch({ type: 'UPDATE_FEATURE', id, params });
  };

  const deleteFeature = (id: string) => {
    dispatch({ type: 'DELETE_FEATURE', id });
  };

  const setActiveFeature = (id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_FEATURE', id });
  };

  const undo = () => dispatch({ type: 'UNDO' });
  const redo = () => dispatch({ type: 'REDO' });

  const value: CadContextType = {
    documentState: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    addFeature,
    updateFeature,
    deleteFeature,
    setActiveFeature,
    undo,
    redo,
  };

  return <CadContext.Provider value={value}>{children}</CadContext.Provider>;
}

/**
 * Hook to consume the CAD context.
 * @returns The CAD context value.
 * @throws Error if used outside CadProvider.
 */
export function useCad(): CadContextType {
  const context = useContext(CadContext);
  if (!context) {
    throw new Error('useCad must be used within a CadProvider');
  }
  return context;
}
