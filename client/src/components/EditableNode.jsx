import React from 'react';
import { Handle, Position } from 'reactflow';

const EditableNode = ({ data, isConnectable }) => {
  const { label = '', attributes = [], onChange } = data;

  const nodeId = data.id; // ✅ Ensure we use the id from data

  const handleLabelChange = (e) => {
    if (onChange) {
      onChange(nodeId, { label: e.target.value, attributes });
    }
  };

  const handleAttributeChange = (index, newValue) => {
    const updated = [...attributes];
    updated[index] = newValue;
    if (onChange) {
      onChange(nodeId, { label, attributes: updated });
    }
  };

  const addAttribute = () => {
    const updated = [...attributes, 'newAttribute'];
    if (onChange) {
      onChange(nodeId, { label, attributes: updated });
    }
  };

  const removeAttribute = (index) => {
    const updated = [...attributes];
    updated.splice(index, 1);
    if (onChange) {
      onChange(nodeId, { label, attributes: updated });
    }
  };

  return (
    <div style={{
      padding: 10,
      backgroundColor: '#f1f5f9',
      border: '1px solid #94a3b8',
      borderRadius: 6,
      minWidth: 160
    }}>
      {/* Editable class name */}
      <input
        type="text"
        value={label}
        onChange={handleLabelChange}
        placeholder="Class Name"
        style={{
          width: '100%',
          background: '#fff',
          border: '1px solid #cbd5e1',
          padding: '4px',
          borderRadius: '4px',
          marginBottom: '8px',
          fontWeight: 'bold'
        }}
      />

      {/* Editable attributes list */}
      <div style={{ marginBottom: '8px' }}>
        {attributes.map((attr, index) => (
          <div key={index} style={{ display: 'flex', marginBottom: '4px' }}>
            <input
              type="text"
              value={attr}
              onChange={(e) => handleAttributeChange(index, e.target.value)}
              style={{
                flex: 1,
                padding: '2px 4px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px'
              }}
            />
            <button
              onClick={() => removeAttribute(index)}
              style={{
                marginLeft: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#ef4444'
              }}
              title="Remove attribute"
            >
              ❌
            </button>
          </div>
        ))}
        <button
          onClick={addAttribute}
          style={{
            marginTop: '4px',
            fontSize: '12px',
            padding: '2px 6px',
            backgroundColor: '#38bdf8',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          ➕ Add Attribute
        </button>
      </div>

      {/* Connection handles */}
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};

export default EditableNode;
