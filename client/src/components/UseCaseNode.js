import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

const UseCaseNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState(data.label);

  const handleSave = () => {
    if (data.onChange) data.onChange(data.id, { label: editedLabel });
    setIsEditing(false);
  };

  return (
    <div
      style={{
        padding: '10px',
        borderRadius: '50%',
        backgroundColor: selected ? '#e3f2fd' : '#fff',
        border: selected ? '3px solid #2196f3' : '2px solid #333',
        width: '100px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '10px',
        boxShadow: selected ? '0 4px 8px rgba(33, 150, 243, 0.3)' : 'none',
        transition: 'all 0.2s ease'
      }}
    >
      <Handle type="target" position={Position.Top} />
      {isEditing ? (
        <input
          type="text"
          value={editedLabel}
          onChange={(e) => setEditedLabel(e.target.value)}
          onBlur={handleSave}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{
            fontSize: '10px',
            textAlign: 'center',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '2px'
          }}
        />
      ) : (
        <div onClick={() => setIsEditing(true)} title="Click to edit use case">
          {editedLabel}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default UseCaseNode;
