import React, { useState, useEffect } from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';

const EditableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
  selected,
  setEdges,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const [label, setLabel] = useState(data?.label || '');
  const [isEditing, setIsEditing] = useState(false);

  // Convert arrow symbols to meaningful text
  const getMeaningfulLabel = (arrowType) => {
    const mapping = {
      '-->': 'association',
      '--': 'association',
      '->': 'directed',
      '..>': 'dependency',
      '<|--': 'inheritance',
      '--|>': 'inheritance',
      '*--': 'composition',
      'o--': 'aggregation'
    };
    return mapping[arrowType] || arrowType;
  };

  // Update label on parent state
  useEffect(() => {
    if (!setEdges) return;
    
    // Convert to meaningful label if it's just an arrow symbol
    const meaningfulLabel = getMeaningfulLabel(data?.label || '');
    if (meaningfulLabel !== label) {
      setLabel(meaningfulLabel);
    }
  }, [data?.label]);

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    if (setEdges) {
      setEdges(prev =>
        prev.map(edge =>
          edge.id === id ? { ...edge, data: { ...edge.data, label: newLabel } } : edge
        )
      );
    }
  };

  const handleLabelSave = () => {
    setIsEditing(false);
  };

  return (
    <>
      <path 
        id={id} 
        style={{
          ...style,
          stroke: selected ? '#2196f3' : style.stroke,
          strokeWidth: selected ? 3 : 2
        }} 
        className="react-flow__edge-path" 
        d={edgePath} 
        markerEnd={markerEnd} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            background: selected ? '#e3f2fd' : 'white',
            padding: '4px 8px',
            borderRadius: 6,
            border: selected ? '2px solid #2196f3' : '2px solid #e2e8f0',
            pointerEvents: 'all',
            minWidth: '80px',
            textAlign: 'center',
            boxShadow: selected ? '0 4px 8px rgba(33, 150, 243, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            zIndex: selected ? 1000 : 1,
            transition: 'all 0.2s ease'
          }}
          onClick={() => setIsEditing(true)}
        >
          {isEditing ? (
            <input
              type="text"
              value={label}
              onChange={handleLabelChange}
              onBlur={handleLabelSave}
              onKeyPress={(e) => e.key === 'Enter' && handleLabelSave()}
              autoFocus
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                textAlign: 'center',
                outline: 'none',
                fontSize: '12px'
              }}
              placeholder="Enter relationship"
            />
          ) : (
            <div style={{ 
              color: '#2d3748', 
              fontWeight: label === 'association' ? 'normal' : 'bold',
              fontStyle: label === 'association' ? 'italic' : 'normal'
            }}>
              {label || 'association'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default EditableEdge;