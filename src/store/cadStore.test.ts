import { describe, expect, it } from 'vitest';

import { cadReducer, initialHistoryState } from './cadStore.ts';
import type { Feature, SketchGeometry } from './types.ts';

describe('cadReducer', () => {
  const mockFeature1: Feature = {
    id: 'f1',
    type: 'sketch',
    name: 'Sketch 1',
    params: {},
    dependencies: [],
  };

  const mockFeature2: Feature = {
    id: 'f2',
    type: 'pad',
    name: 'Pad 1',
    params: { distance: 10 },
    dependencies: ['f1'],
  };

  it('handles ADD_FEATURE action', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });
    expect(state.present.features).toHaveLength(1);
    expect(state.present.features[0]).toEqual(mockFeature1);
    expect(state.present.activeFeatureId).toBe('f1');
    expect(state.past).toHaveLength(1);
    expect(state.past[0].features).toHaveLength(0);

    state = cadReducer(state, { type: 'ADD_FEATURE', feature: mockFeature2 });
    expect(state.present.features).toHaveLength(2);
    expect(state.present.features[1]).toEqual(mockFeature2);
    expect(state.present.activeFeatureId).toBe('f2');
    expect(state.past).toHaveLength(2);
  });

  it('handles UNDO and REDO actions', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });
    state = cadReducer(state, { type: 'ADD_FEATURE', feature: mockFeature2 });

    // Undo
    state = cadReducer(state, { type: 'UNDO' });
    expect(state.present.features).toHaveLength(1);
    expect(state.present.activeFeatureId).toBe('f1');
    expect(state.future).toHaveLength(1);

    // Redo
    state = cadReducer(state, { type: 'REDO' });
    expect(state.present.features).toHaveLength(2);
    expect(state.present.activeFeatureId).toBe('f2');
    expect(state.future).toHaveLength(0);
  });

  it('handles UPDATE_FEATURE action', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });
    state = cadReducer(state, { type: 'ADD_FEATURE', feature: mockFeature2 });

    state = cadReducer(state, {
      type: 'UPDATE_FEATURE',
      id: 'f2',
      params: { distance: 20 },
    });

    expect(state.present.features[1].params.distance).toBe(20);
  });

  it('handles DELETE_FEATURE and cascades dependencies', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });
    state = cadReducer(state, { type: 'ADD_FEATURE', feature: mockFeature2 });

    // Delete f1 (which f2 depends on)
    state = cadReducer(state, { type: 'DELETE_FEATURE', id: 'f1' });
    expect(state.present.features).toHaveLength(0);
    expect(state.present.activeFeatureId).toBeNull();
  });

  it('handles SET_ACTIVE_FEATURE (rollback)', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });
    state = cadReducer(state, { type: 'ADD_FEATURE', feature: mockFeature2 });

    // Rollback to f1
    state = cadReducer(state, { type: 'SET_ACTIVE_FEATURE', id: 'f1' });
    expect(state.present.activeFeatureId).toBe('f1');
    // Features list is intact, pointer is rolled back
    expect(state.present.features).toHaveLength(2);

    // Add new feature while rolled back should truncate future
    const mockFeature3: Feature = {
      id: 'f3',
      type: 'pocket',
      name: 'Pocket 1',
      params: {},
      dependencies: ['f1'],
    };
    state = cadReducer(state, { type: 'ADD_FEATURE', feature: mockFeature3 });
    expect(state.present.features).toHaveLength(2); // f1 and f3 (f2 is truncated)
    expect(state.present.features[0].id).toBe('f1');
    expect(state.present.features[1].id).toBe('f3');
  });

  it('handles sketch editing and geometry actions', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });

    // Enter edit mode
    state = cadReducer(state, { type: 'ENTER_SKETCH_EDIT', id: 'f1' });
    expect(state.present.activeSketchId).toBe('f1');

    // Add a line geometry
    state = cadReducer(state, {
      type: 'ADD_SKETCH_GEOMETRY',
      geometry: { type: 'line', id: 'l1', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
    });
    const geoms = state.present.features[0].params.geometries as SketchGeometry[];
    expect(geoms).toHaveLength(1);
    expect(geoms[0].type).toBe('line');
    expect(geoms[0].id).toBe('l1');

    // Delete geometry
    state = cadReducer(state, { type: 'DELETE_SKETCH_GEOMETRY', geometryId: 'l1' });
    expect(state.present.features[0].params.geometries).toHaveLength(0);

    // Exit edit mode
    state = cadReducer(state, { type: 'EXIT_SKETCH_EDIT' });
    expect(state.present.activeSketchId).toBeNull();
  });

  it('calculates degrees of freedom (DOF) and updates status on UPDATE_FEATURE', () => {
    let state = cadReducer(initialHistoryState, { type: 'ADD_FEATURE', feature: mockFeature1 });
    state = cadReducer(state, { type: 'ENTER_SKETCH_EDIT', id: 'f1' });

    // Add a line geometry (starts with 4 variables/4 DOF)
    state = cadReducer(state, {
      type: 'ADD_SKETCH_GEOMETRY',
      geometry: { type: 'line', id: 'l1', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
    });

    expect(state.present.features[0].params.dof).toBe(4);

    // Apply horizontal constraint (adds 1 equation, leaves 3 DOF)
    state = cadReducer(state, {
      type: 'UPDATE_FEATURE',
      id: 'f1',
      params: {
        ...state.present.features[0].params,
        constraints: [
          {
            id: 'c1',
            type: 'horizontal',
            targets: [{ geomId: 'l1' }],
          },
        ],
      },
    });

    expect(state.present.features[0].params.dof).toBe(3);
    expect(state.present.features[0].params.converged).toBe(true);
  });
});
