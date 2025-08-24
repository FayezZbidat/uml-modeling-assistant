import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

const ParticipantNode = ({ data, selected }) => {
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
        backgroundColor: selected ? '#e3f2fd' : '#fff',
        border: selected ? '3px solid #2196f3' : '1px solid #333',
        borderRadius: '4px',
        minWidth: '80px',
        textAlign: 'center',
        boxShadow: selected ? '0 4px 8px rgba(33, 150, 243, 0.3)' : 'none',
        transition: 'all 0.2s ease'
      }}
    >
      <Handle type="target" position={Position.Left} />
      {isEditing ? (
        <input
          type="text"
          value={editedLabel}
          onChange={(e) => setEditedLabel(e.target.value)}
          onBlur={handleSave}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{
            fontSize: '12px',
            textAlign: 'center',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '2px'
          }}
        />
      ) : (
        <div onClick={() => setIsEditing(true)} title="Click to edit participant">
          {editedLabel}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export default ParticipantNode;
