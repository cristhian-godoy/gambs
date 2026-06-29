import {
  AlignJustify,
  Circle,
  CircleDot,
  Compass,
  CornerDownRight,
  Download,
  File,
  FilePlus,
  FolderOpen,
  Link as LinkIcon,
  Lock,
  MousePointer,
  MoveRight,
  MoveUp,
  Redo2,
  Ruler,
  Save,
  Slash,
  Square,
  ToggleLeft,
  Undo2,
  Upload,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { buildSolidFromFeatures } from '../core/brep.ts';
import { type SelectedElement, useCad } from '../store/CadContext.tsx';
import type { SketchGeometry } from '../store/types.ts';
import { exportToObj, exportToStep, exportToStl, importFromStep } from '../utils/exporters.ts';

/**
 * Top Toolbar component containing global actions, drawing tools, and constraint application.
 * @returns The rendered Toolbar component.
 */
export default function Toolbar(): ReactNode {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    activeTool,
    setActiveTool,
    selectedElements,
    setSelectedElements,
    toggleConstructionGeometries,
    addSketchConstraint,
    documentState,
    addFeature,
    resetDocument,
    loadDocument,
  } = useCad();

  const { activeSketchId, features } = documentState;
  const activeSketch = features.find((f) => f.id === activeSketchId);
  const geometries = (activeSketch?.params.geometries as SketchGeometry[]) || [];

  const [fileMenuOpen, setFileMenuOpen] = useState(false);

  const handleSaveProject = () => {
    const dataStr = JSON.stringify(documentState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'project.json');
    linkElement.click();
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const doc = JSON.parse(event.target?.result as string);
        if (doc && Array.isArray(doc.features)) {
          loadDocument(doc);
        }
      } catch (err) {
        console.error('Failed to parse project file', err);
      }
    };
    reader.readAsText(file);
    setFileMenuOpen(false);
  };

  const handleExportStl = () => {
    const solid = buildSolidFromFeatures(features);
    exportToStl(solid, 'model.stl');
  };

  const handleExportObj = () => {
    const solid = buildSolidFromFeatures(features);
    exportToObj(solid, 'model.obj');
  };

  const handleExportStep = () => {
    const solid = buildSolidFromFeatures(features);
    exportToStep(solid, 'model.stp');
  };

  const handleImportStep = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const importedShape = importFromStep(content);
      if (importedShape.vertices.length > 0) {
        const geoms = importedShape.vertices.map((v, idx) => ({
          type: 'line' as const,
          id: `line_imported_${idx}_${Date.now()}`,
          start: { x: v.x, y: v.y },
          end: { x: v.x + 10, y: v.y },
        }));
        addFeature('sketch', 'Imported STEP', { geometries: geoms }, []);
      }
    };
    reader.readAsText(file);
  };

  // Helper to resolve the type of a selected element
  const getElementType = (el: SelectedElement) => {
    if (el.vertexType !== undefined || el.geomId === 'datum_origin') {
      return 'point';
    }
    const geom = geometries.find((g) => g.id === el.geomId);
    return geom ? geom.type : null;
  };

  const pointCount = selectedElements.filter((el) => getElementType(el) === 'point').length;
  const lineCount = selectedElements.filter((el) => getElementType(el) === 'line').length;
  const circleCount = selectedElements.filter((el) => getElementType(el) === 'circle').length;
  const totalCount = selectedElements.length;

  // Selection constraints checks
  const canCoincident = pointCount === 2 && totalCount === 2;
  const canHorizontal = lineCount === 1 && totalCount === 1;
  const canVertical = lineCount === 1 && totalCount === 1;
  const canParallel = lineCount === 2 && totalCount === 2;
  const canPerpendicular = lineCount === 2 && totalCount === 2;
  const canFixed = pointCount === 1 && totalCount === 1;
  const canRadius = circleCount === 1 && totalCount === 1;
  const canAngle = lineCount === 2 && totalCount === 2;
  const canDistance =
    (pointCount === 2 && totalCount === 2) || (lineCount === 1 && totalCount === 1);
  const canTangent =
    (lineCount === 1 && circleCount === 1 && totalCount === 2) ||
    (circleCount === 2 && totalCount === 2);

  // Construction toggle check (ignore virtual datums)
  const validConstructionSelection = selectedElements
    .filter((el) => !el.geomId.startsWith('datum_') && el.vertexType === undefined)
    .map((el) => el.geomId);
  const hasConstructionSelection = validConstructionSelection.length > 0;

  // Constraint callbacks
  const applyCoincident = () => {
    addSketchConstraint({
      type: 'coincident',
      targets: selectedElements.map((el) => ({
        geomId: el.geomId,
        vertexType: el.vertexType,
      })),
    });
    setSelectedElements([]);
  };

  const applyHorizontal = () => {
    addSketchConstraint({
      type: 'horizontal',
      targets: [{ geomId: selectedElements[0].geomId }],
    });
    setSelectedElements([]);
  };

  const applyVertical = () => {
    addSketchConstraint({
      type: 'vertical',
      targets: [{ geomId: selectedElements[0].geomId }],
    });
    setSelectedElements([]);
  };

  const applyParallel = () => {
    addSketchConstraint({
      type: 'parallel',
      targets: selectedElements.map((el) => ({ geomId: el.geomId })),
    });
    setSelectedElements([]);
  };

  const applyPerpendicular = () => {
    addSketchConstraint({
      type: 'perpendicular',
      targets: selectedElements.map((el) => ({ geomId: el.geomId })),
    });
    setSelectedElements([]);
  };

  const applyTangent = () => {
    addSketchConstraint({
      type: 'tangent',
      targets: selectedElements.map((el) => ({ geomId: el.geomId })),
    });
    setSelectedElements([]);
  };

  const applyFixed = () => {
    const val = parseFloat(prompt('Enter fixed coordinate value (mm):', '0') || '');
    if (!isNaN(val)) {
      addSketchConstraint({
        type: 'fixed',
        targets: [
          { geomId: selectedElements[0].geomId, vertexType: selectedElements[0].vertexType },
        ],
        value: val,
      });
      setSelectedElements([]);
    }
  };

  const applyDistance = () => {
    const val = parseFloat(prompt('Enter distance/length in mm:', '10') || '');
    if (!isNaN(val)) {
      const targets =
        getElementType(selectedElements[0]) === 'line'
          ? [
              { geomId: selectedElements[0].geomId, vertexType: 'start' as const },
              { geomId: selectedElements[0].geomId, vertexType: 'end' as const },
            ]
          : selectedElements.map((el) => ({ geomId: el.geomId, vertexType: el.vertexType }));

      addSketchConstraint({
        type: 'distance',
        targets,
        value: val,
      });
      setSelectedElements([]);
    }
  };

  const applyRadius = () => {
    const val = parseFloat(prompt('Enter circle radius in mm:', '5') || '');
    if (!isNaN(val)) {
      addSketchConstraint({
        type: 'radius',
        targets: [{ geomId: selectedElements[0].geomId }],
        value: val,
      });
      setSelectedElements([]);
    }
  };

  const applyAngle = () => {
    const val = parseFloat(prompt('Enter angle in degrees:', '90') || '');
    if (!isNaN(val)) {
      addSketchConstraint({
        type: 'angle',
        targets: selectedElements.map((el) => ({ geomId: el.geomId })),
        value: (val * Math.PI) / 180,
      });
      setSelectedElements([]);
    }
  };

  return (
    <header className="top-toolbar">
      <div className="toolbar-group">
        <span className="toolbar-title">
          <span>📐</span> SPA CAD
        </span>
        <div className="file-menu-container" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn primary"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            title="File Menu"
          >
            <File size={16} /> File
          </button>

          {fileMenuOpen && (
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
                  resetDocument();
                  setFileMenuOpen(false);
                }}
              >
                <FilePlus size={14} /> New Project
              </button>

              <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                <FolderOpen size={14} /> Open Project
                <input
                  type="file"
                  accept=".json"
                  onChange={handleOpenProject}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                className="dropdown-item"
                onClick={() => {
                  handleSaveProject();
                  setFileMenuOpen(false);
                }}
              >
                <Save size={14} /> Save Project
              </button>

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--cad-glass-border-base)',
                  margin: '4px 0',
                }}
              />

              <div
                style={{
                  padding: '4px 16px',
                  fontSize: '0.75rem',
                  color: 'var(--cad-color-text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Export / Import
              </div>

              <button
                className="dropdown-item"
                onClick={() => {
                  handleExportStl();
                  setFileMenuOpen(false);
                }}
              >
                <Download size={14} /> Export STL
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  handleExportObj();
                  setFileMenuOpen(false);
                }}
              >
                <Download size={14} /> Export OBJ
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  handleExportStep();
                  setFileMenuOpen(false);
                }}
              >
                <Download size={14} /> Export STEP
              </button>

              <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                <Upload size={14} /> Import STEP
                <input
                  type="file"
                  accept=".stp,.step"
                  onChange={(e) => {
                    handleImportStep(e);
                    setFileMenuOpen(false);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
        <div className="toolbar-divider" />

        {/* Drawing Tools Group */}
        <button
          className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select Tool (Esc)"
        >
          <MousePointer size={16} />
          Select
        </button>
        <button
          className={`toolbar-btn ${activeTool === 'line' ? 'active' : ''}`}
          onClick={() => setActiveTool('line')}
          title="Line Tool"
        >
          <Slash size={16} />
          Line
        </button>
        <button
          className={`toolbar-btn ${activeTool === 'circle' ? 'active' : ''}`}
          onClick={() => setActiveTool('circle')}
          title="Circle Tool"
        >
          <Circle size={16} />
          Circle
        </button>
        <button
          className={`toolbar-btn ${activeTool === 'rect' ? 'active' : ''}`}
          onClick={() => setActiveTool('rect')}
          title="Rectangle Tool"
        >
          <Square size={16} />
          Rectangle
        </button>

        <div className="toolbar-divider" />

        {/* Constraints Actions Group */}
        {activeSketchId && (
          <>
            <button
              className="toolbar-btn"
              onClick={applyCoincident}
              disabled={!canCoincident}
              title="Coincident Constraint (Select 2 points)"
              style={{ opacity: canCoincident ? 1 : 0.4 }}
            >
              <LinkIcon size={16} />
              Coincident
            </button>
            <button
              className="toolbar-btn"
              onClick={applyHorizontal}
              disabled={!canHorizontal}
              title="Horizontal Constraint (Select 1 line)"
              style={{ opacity: canHorizontal ? 1 : 0.4 }}
            >
              <MoveRight size={16} />
              Horiz
            </button>
            <button
              className="toolbar-btn"
              onClick={applyVertical}
              disabled={!canVertical}
              title="Vertical Constraint (Select 1 line)"
              style={{ opacity: canVertical ? 1 : 0.4 }}
            >
              <MoveUp size={16} />
              Vert
            </button>
            <button
              className="toolbar-btn"
              onClick={applyParallel}
              disabled={!canParallel}
              title="Parallel Constraint (Select 2 lines)"
              style={{ opacity: canParallel ? 1 : 0.4 }}
            >
              <AlignJustify size={16} />
              Parallel
            </button>
            <button
              className="toolbar-btn"
              onClick={applyPerpendicular}
              disabled={!canPerpendicular}
              title="Perpendicular Constraint (Select 2 lines)"
              style={{ opacity: canPerpendicular ? 1 : 0.4 }}
            >
              <CornerDownRight size={16} />
              Perp
            </button>
            <button
              className="toolbar-btn"
              onClick={applyTangent}
              disabled={!canTangent}
              title="Tangent Constraint (Select Line + Circle or 2 Circles)"
              style={{ opacity: canTangent ? 1 : 0.4 }}
            >
              <CircleDot size={16} />
              Tangent
            </button>
            <button
              className="toolbar-btn"
              onClick={applyFixed}
              disabled={!canFixed}
              title="Fixed Constraint (Select 1 point)"
              style={{ opacity: canFixed ? 1 : 0.4 }}
            >
              <Lock size={16} />
              Fix
            </button>
            <button
              className="toolbar-btn"
              onClick={applyDistance}
              disabled={!canDistance}
              title="Distance/Length Constraint (Select 2 points or 1 line)"
              style={{ opacity: canDistance ? 1 : 0.4 }}
            >
              <Ruler size={16} />
              Dimension
            </button>
            <button
              className="toolbar-btn"
              onClick={applyRadius}
              disabled={!canRadius}
              title="Radius Constraint (Select 1 circle)"
              style={{ opacity: canRadius ? 1 : 0.4 }}
            >
              <Circle size={16} />
              Radius
            </button>
            <button
              className="toolbar-btn"
              onClick={applyAngle}
              disabled={!canAngle}
              title="Angle Constraint (Select 2 lines)"
              style={{ opacity: canAngle ? 1 : 0.4 }}
            >
              <Compass size={16} />
              Angle
            </button>

            <div className="toolbar-divider" />
            <button
              className="toolbar-btn"
              onClick={() => toggleConstructionGeometries(validConstructionSelection)}
              disabled={!hasConstructionSelection}
              title="Toggle Construction Line"
              style={{
                opacity: hasConstructionSelection ? 1 : 0.4,
                cursor: hasConstructionSelection ? 'pointer' : 'not-allowed',
              }}
            >
              <ToggleLeft size={16} />
              Construction
            </button>
            <div className="toolbar-divider" />
          </>
        )}

        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <Undo2 size={16} />
          Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <Redo2 size={16} />
          Redo
        </button>
      </div>
      <div className="toolbar-group">
        <span style={{ fontSize: '0.8rem', color: 'var(--cad-color-text-muted)' }}>
          Mode: {activeTool.toUpperCase()}
        </span>
      </div>
    </header>
  );
}
