import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

const ActorNode = ({ data, selected }) => {
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
        width: '60px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '10px'
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
        <div onClick={() => setIsEditing(true)} title="Click to edit actor">
          👤 {editedLabel}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default ActorNode;
