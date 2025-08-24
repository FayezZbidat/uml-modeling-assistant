import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

const EditableNode = ({ data, isConnectable, selected }) => {
  const { label = '', attributes = [], onChange } = data;
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingAttributes, setIsEditingAttributes] = useState(false);
  const [editedLabel, setEditedLabel] = useState(label);
  const [editedAttributes, setEditedAttributes] = useState([...attributes]);

  const nodeId = data.id;

  const handleLabelChange = (e) => {
    setEditedLabel(e.target.value);
  };

  const handleLabelSave = () => {
    if (onChange) {
      onChange(nodeId, { label: editedLabel, attributes: editedAttributes });
    }
    setIsEditingLabel(false);
  };

  const handleAttributeChange = (index, value) => {
    const updated = [...editedAttributes];
    updated[index] = value;
    setEditedAttributes(updated);
  };

  const handleAttributesSave = () => {
    if (onChange) {
      onChange(nodeId, { label: editedLabel, attributes: editedAttributes });
    }
    setIsEditingAttributes(false);
  };

  const addAttribute = () => {
    setEditedAttributes([...editedAttributes, '+ newAttribute()']);
  };

  const removeAttribute = (index) => {
    const updated = editedAttributes.filter((_, i) => i !== index);
    setEditedAttributes(updated);
  };

  return (
    <div style={{
      padding: 10,
      backgroundColor: selected ? '#e3f2fd' : '#f8f9fa',
      border: selected ? '3px solid #2196f3' : '2px solid #4a5568',
      borderRadius: 8,
      minWidth: 180,
      boxShadow: selected ? '0 4px 8px rgba(33, 150, 243, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease'
    }}>
      {/* Editable class name */}
      <div style={{ 
        borderBottom: '2px solid #4a5568', 
        paddingBottom: 8, 
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {isEditingLabel ? (
          <input
            type="text"
            value={editedLabel}
            onChange={handleLabelChange}
            onBlur={handleLabelSave}
            onKeyPress={(e) => e.key === 'Enter' && handleLabelSave()}
            autoFocus
            style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #cbd5e1',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          />
        ) : (
          <div
            style={{ 
              flex: 1, 
              fontWeight: 'bold', 
              cursor: 'pointer',
              padding: '4px'
            }}
            onClick={() => setIsEditingLabel(true)}
            title="Click to edit class name"
          >
            {editedLabel}
          </div>
        )}
        <button
          onClick={() => setIsEditingLabel(!isEditingLabel)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '4px'
          }}
          title={isEditingLabel ? 'Save' : 'Edit class name'}
        >
          {isEditingLabel ? '💾' : '✏️'}
        </button>
      </div>

      {/* Editable attributes list */}
      <div style={{ marginBottom: 8 }}>
        {isEditingAttributes ? (
          <>
            {editedAttributes.map((attr, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <input
                  type="text"
                  value={attr}
                  onChange={(e) => handleAttributeChange(index, e.target.value)}
                  style={{
                    flex: 1,
                    padding: '2px 6px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                  placeholder="+ attribute()"
                />
                <button
                  onClick={() => removeAttribute(index)}
                  style={{
                    marginLeft: 4,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#e53e3e',
                    fontSize: '12px'
                  }}
                  title="Remove attribute"
                >
                  ❌
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button
                onClick={addAttribute}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: '#38a169',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ➕ Add
              </button>
              <button
                onClick={handleAttributesSave}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: '#3182ce',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                💾 Save
              </button>
            </div>
          </>
        ) : (
          <>
            {editedAttributes.map((attr, index) => (
              <div 
                key={index} 
                style={{ 
                  fontSize: '12px', 
                  padding: '2px 4px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  marginBottom: 2
                }}
                onClick={() => setIsEditingAttributes(true)}
                title="Click to edit attributes"
              >
                {attr}
              </div>
            ))}
            {editedAttributes.length === 0 && (
              <div 
                style={{ 
                  fontSize: '11px', 
                  color: '#718096', 
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                onClick={() => setIsEditingAttributes(true)}
                title="Click to add attributes"
              >
                + Click to add attributes...
              </div>
            )}
          </>
        )}
      </div>

      {/* Connection handles */}
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};

export default EditableNode;