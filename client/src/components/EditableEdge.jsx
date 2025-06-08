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

  // Update label on parent state
  useEffect(() => {
    if (!setEdges) return;
    setEdges(prev =>
      prev.map(edge =>
        edge.id === id ? { ...edge, data: { ...edge.data, label } } : edge
      )
    );
  }, [label]);

  return (
    <>
      <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            background: 'white',
            padding: '2px 4px',
            borderRadius: 4,
            border: '1px solid #ccc',
            pointerEvents: 'all',
            minWidth: '60px',
          }}
        >
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              textAlign: 'center',
            }}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default EditableEdge;
