/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useContext, useReducer, useState } from 'react';

import type { SketchConstraint } from '../core/solver.ts';
import { cadReducer, initialHistoryState } from './cadStore.ts';
import type { DocumentState, Feature, FeatureType, SketchGeometry } from './types.ts';

/**
 * Types of active canvas interaction tools.
 */
export type ToolType = 'select' | 'line' | 'circle' | 'rect' | 'arc' | 'triangle' | 'slot';

/**
 * Represents a selected sketch element (geometry or specific vertex).
 */
export interface SelectedElement {
  geomId: string;
  vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
}

import { type AppSettings, settingsStore, useSettings } from './settingsStore.ts';
export type { AppSettings };

/**
 * Represents a selected sketch element (geometry or specific vertex).
 */
export interface SelectedElement {
  geomId: string;
  vertexType?: 'start' | 'end' | 'center' | 'corner1' | 'corner2';
}

/**
 * Context properties and callbacks for CAD application state.
 */
interface CadContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  documentState: DocumentState;
  canUndo: boolean;
  canRedo: boolean;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedElements: SelectedElement[];
  setSelectedElements: (elements: SelectedElement[]) => void;
  addFeature: (
    type: FeatureType,
    name: string,
    params?: Record<string, unknown>,
    dependencies?: string[],
  ) => string;
  updateFeature: (id: string, params: Record<string, unknown>) => void;
  deleteFeature: (id: string) => void;
  setActiveFeature: (id: string | null) => void;
  setActiveBody: (id: string | null) => void;
  enterSketchEdit: (id: string) => void;
  exitSketchEdit: () => void;
  addSketchGeometry: (geometry: SketchGeometry) => void;
  addSketchElements: (geometries: SketchGeometry[], constraints: SketchConstraint[]) => void;
  deleteSketchGeometry: (geometryId: string) => void;
  toggleConstructionGeometries: (geomIds: string[]) => void;
  addSketchConstraint: (c: Omit<SketchConstraint, 'id'>) => void;
  updateSketchConstraint: (constraintId: string, value: number) => void;
  deleteSketchConstraint: (constraintId: string) => void;
  undo: () => void;
  redo: () => void;
  resetDocument: () => void;
  loadDocument: (doc: DocumentState) => void;
  selectionFilter: 'vertices' | 'edges' | 'faces' | 'all';
  setSelectionFilter: (filter: 'vertices' | 'edges' | 'faces' | 'all') => void;
  isSelectingSupportPlane: boolean;
  setIsSelectingSupportPlane: (val: boolean) => void;
  contextMenu: {
    x: number;
    y: number;
    options: { label: string; action: () => void }[];
  } | null;
  showContextMenu: (x: number, y: number, options: { label: string; action: () => void }[]) => void;
  closeContextMenu: () => void;
}

const CadContext = createContext<CadContextType | undefined>(undefined);

/**
 * Context Provider component for managing CAD document state.
 * @param props Props containing children node.
 * @returns The rendered CadProvider component.
 */
export function CadProvider({ children }: { children: ReactNode }): ReactNode {
  const [history, dispatch] = useReducer(cadReducer, initialHistoryState);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [isSelectingSupportPlane, setIsSelectingSupportPlane] = useState(false);
  const [selectionFilter, setSelectionFilter] = useState<'vertices' | 'edges' | 'faces' | 'all'>(
    'all',
  );
  const settings = useSettings();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    options: { label: string; action: () => void }[];
  } | null>(null);

  const showContextMenu = (
    x: number,
    y: number,
    options: { label: string; action: () => void }[],
  ) => {
    setContextMenu({ x, y, options });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settingsStore.updateSettings(newSettings);
  };

  const addFeature = (
    type: FeatureType,
    name: string,
    params: Record<string, unknown> = {},
    dependencies: string[] = [],
  ): string => {
    const id = `${type}_${Date.now()}`;
    const feature: Feature = { id, type, name, params, dependencies };
    dispatch({ type: 'ADD_FEATURE', feature });
    return id;
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

  const enterSketchEdit = (id: string) => {
    dispatch({ type: 'ENTER_SKETCH_EDIT', id });
  };

  const exitSketchEdit = () => {
    dispatch({ type: 'EXIT_SKETCH_EDIT' });
  };

  const addSketchGeometry = (geometry: SketchGeometry) => {
    dispatch({ type: 'ADD_SKETCH_GEOMETRY', geometry });
  };

  const addSketchElements = (geometries: SketchGeometry[], constraints: SketchConstraint[]) => {
    dispatch({ type: 'ADD_SKETCH_ELEMENTS', geometries, constraints });
  };

  const deleteSketchGeometry = (geometryId: string) => {
    dispatch({ type: 'DELETE_SKETCH_GEOMETRY', geometryId });
  };

  const toggleConstructionGeometries = (geomIds: string[]) => {
    const activeSketchId = history.present.activeSketchId;
    if (!activeSketchId) return;

    const activeSketch = history.present.features.find((f) => f.id === activeSketchId);
    if (!activeSketch) return;

    const currentGeometries = (activeSketch.params.geometries as SketchGeometry[]) || [];
    const nextGeometries = currentGeometries.map((g) => {
      if (geomIds.includes(g.id)) {
        return {
          ...g,
          isConstruction: !g.isConstruction,
        };
      }
      return g;
    });

    dispatch({
      type: 'UPDATE_FEATURE',
      id: activeSketchId,
      params: { ...activeSketch.params, geometries: nextGeometries },
    });
  };

  const addSketchConstraint = (c: Omit<SketchConstraint, 'id'>) => {
    const activeSketchId = history.present.activeSketchId;
    if (!activeSketchId) return;

    const activeSketch = history.present.features.find((f) => f.id === activeSketchId);
    if (!activeSketch) return;

    const currentConstraints = (activeSketch.params.constraints as SketchConstraint[]) || [];
    const id = `c_${Date.now()}`;
    const newConstraint: SketchConstraint = { ...c, id };

    dispatch({
      type: 'UPDATE_FEATURE',
      id: activeSketchId,
      params: {
        ...activeSketch.params,
        constraints: [...currentConstraints, newConstraint],
      },
    });
  };

  const updateSketchConstraint = (constraintId: string, value: number) => {
    const activeSketchId = history.present.activeSketchId;
    if (!activeSketchId) return;

    const activeSketch = history.present.features.find((f) => f.id === activeSketchId);
    if (!activeSketch) return;

    const currentConstraints = (activeSketch.params.constraints as SketchConstraint[]) || [];
    const nextConstraints = currentConstraints.map((c) => {
      if (c.id === constraintId) {
        return { ...c, value };
      }
      return c;
    });

    dispatch({
      type: 'UPDATE_FEATURE',
      id: activeSketchId,
      params: { ...activeSketch.params, constraints: nextConstraints },
    });
  };

  const deleteSketchConstraint = (constraintId: string) => {
    const activeSketchId = history.present.activeSketchId;
    if (!activeSketchId) return;

    const activeSketch = history.present.features.find((f) => f.id === activeSketchId);
    if (!activeSketch) return;

    const currentConstraints = (activeSketch.params.constraints as SketchConstraint[]) || [];

    dispatch({
      type: 'UPDATE_FEATURE',
      id: activeSketchId,
      params: {
        ...activeSketch.params,
        constraints: currentConstraints.filter((c) => c.id !== constraintId),
      },
    });
  };

  const setActiveBody = (id: string | null) => dispatch({ type: 'SET_ACTIVE_BODY', id });

  const undo = () => dispatch({ type: 'UNDO' });
  const redo = () => dispatch({ type: 'REDO' });
  const resetDocument = () => dispatch({ type: 'RESET_DOCUMENT' });
  const loadDocument = (doc: DocumentState) => dispatch({ type: 'LOAD_DOCUMENT', document: doc });

  const value: CadContextType = {
    settings,
    updateSettings,
    documentState: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    activeTool,
    setActiveTool,
    selectedElements,
    setSelectedElements,
    addFeature,
    updateFeature,
    deleteFeature,
    setActiveFeature,
    setActiveBody,
    enterSketchEdit,
    exitSketchEdit,
    addSketchGeometry,
    addSketchElements,
    deleteSketchGeometry,
    toggleConstructionGeometries,
    addSketchConstraint,
    updateSketchConstraint,
    deleteSketchConstraint,
    undo,
    redo,
    resetDocument,
    loadDocument,
    selectionFilter,
    setSelectionFilter,
    isSelectingSupportPlane,
    setIsSelectingSupportPlane,
    contextMenu,
    showContextMenu,
    closeContextMenu,
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
