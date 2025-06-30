import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Panel,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import plantumlEncoder from 'plantuml-encoder';

// Custom node component for UML classes
const ClassNode = ({ data, isConnectable }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    data.onChange(data.id, editedData);
    setIsEditing(false);
  };

  const handleAttributeChange = (index, value) => {
    const newAttributes = [...editedData.attributes];
    newAttributes[index] = value;
    setEditedData({ ...editedData, attributes: newAttributes });
  };

  const handleMethodChange = (index, value) => {
    const newMethods = [...editedData.methods];
    newMethods[index] = value;
    setEditedData({ ...editedData, methods: newMethods });
  };

  const addAttribute = () => {
    setEditedData({
      ...editedData,
      attributes: [...editedData.attributes, 'newAttribute']
    });
  };

  const addMethod = () => {
    setEditedData({
      ...editedData,
      methods: [...editedData.methods, 'newMethod()']
    });
  };

  const removeAttribute = (index) => {
    const newAttributes = editedData.attributes.filter((_, i) => i !== index);
    setEditedData({ ...editedData, attributes: newAttributes });
  };

  const removeMethod = (index) => {
    const newMethods = editedData.methods.filter((_, i) => i !== index);
    setEditedData({ ...editedData, methods: newMethods });
  };

  return (
    <div style={styles.classNode}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={styles.handle}
      />
      
      <div style={styles.classHeader}>
        {isEditing ? (
          <input
            type="text"
            value={editedData.label}
            onChange={(e) => setEditedData({ ...editedData, label: e.target.value })}
            style={styles.input}
            autoFocus
          />
        ) : (
          <strong>{data.label}</strong>
        )}
        <button
          onClick={isEditing ? handleSave : handleEdit}
          style={styles.editButton}
        >
          {isEditing ? '💾' : '✏️'}
        </button>
      </div>

      {data.attributes && data.attributes.length > 0 && (
        <div style={styles.classSection}>
          <div style={styles.sectionHeader}>Attributes</div>
          {isEditing ? (
            <>
              {editedData.attributes.map((attr, index) => (
                <div key={index} style={styles.editRow}>
                  <input
                    type="text"
                    value={attr}
                    onChange={(e) => handleAttributeChange(index, e.target.value)}
                    style={styles.smallInput}
                  />
                  <button
                    onClick={() => removeAttribute(index)}
                    style={styles.removeButton}
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button onClick={addAttribute} style={styles.addButton}>
                + Add Attribute
              </button>
            </>
          ) : (
            data.attributes.map((attr, index) => (
              <div key={index} style={styles.attribute}>+ {attr}</div>
            ))
          )}
        </div>
      )}

      {data.methods && data.methods.length > 0 && (
        <div style={styles.classSection}>
          <div style={styles.sectionHeader}>Methods</div>
          {isEditing ? (
            <>
              {editedData.methods.map((method, index) => (
                <div key={index} style={styles.editRow}>
                  <input
                    type="text"
                    value={method}
                    onChange={(e) => handleMethodChange(index, e.target.value)}
                    style={styles.smallInput}
                  />
                  <button
                    onClick={() => removeMethod(index)}
                    style={styles.removeButton}
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button onClick={addMethod} style={styles.addButton}>
                + Add Method
              </button>
            </>
          ) : (
            data.methods.map((method, index) => (
              <div key={index} style={styles.method}>+ {method}</div>
            ))
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={styles.handle}
      />
    </div>
  );
};

// Custom edge component with label editing
const EditableEdge = ({ id, sourceX, sourceY, targetX, targetY, data, style, markerEnd }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data?.label || '');

  const edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const handleLabelChange = (e) => {
    setLabel(e.target.value);
    if (data?.onChange) {
      data.onChange(id, { label: e.target.value });
    }
  };

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <g transform={`translate(${midX}, ${midY})`}>
        {isEditing ? (
          <foreignObject x="-50" y="-10" width="100" height="20">
            <input
              type="text"
              value={label}
              onChange={handleLabelChange}
              onBlur={() => setIsEditing(false)}
              style={styles.edgeInput}
              autoFocus
            />
          </foreignObject>
        ) : (
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="middle"
            style={styles.edgeLabel}
            onClick={() => setIsEditing(true)}
          >
            {label}
          </text>
        )}
      </g>
    </>
  );
};

// Main diagram editor component
const DiagramEditor = ({ initialPlantUML, onSave }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showEditPanel, setShowEditPanel] = useState(false);

  // Parse PlantUML to nodes and edges
  useEffect(() => {
    if (initialPlantUML) {
      const { nodes: parsedNodes, edges: parsedEdges } = parsePlantUMLToFlow(initialPlantUML);
      setNodes(parsedNodes);
      setEdges(parsedEdges);
    }
  }, [initialPlantUML, setNodes, setEdges]);

  // Parse PlantUML code to ReactFlow elements
  const parsePlantUMLToFlow = (plantuml) => {
    const lines = plantuml.split('\n');
    const classes = {};
    const relationships = [];
    let currentClass = null;
    let yPosition = 50;
    let xPosition = 50;

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Parse class definition
      const classMatch = trimmed.match(/^class\s+(\w+)\s*\{?$/);
      if (classMatch) {
        currentClass = classMatch[1];
        classes[currentClass] = {
          attributes: [],
          methods: []
        };
        return;
      }

      // Parse attributes and methods
      if (currentClass && trimmed.startsWith('+')) {
        const content = trimmed.substring(1).trim();
        if (content.includes('(')) {
          classes[currentClass].methods.push(content);
        } else {
          classes[currentClass].attributes.push(content);
        }
        return;
      }

      // Parse relationships
      const relMatch = trimmed.match(/(\w+)\s*(--|->|\.\.>|<\|--|--\|>|\*--|o--)\s*(\w+)\s*:\s*(.*)/);
      if (relMatch) {
        relationships.push({
          from: relMatch[1],
          to: relMatch[3],
          type: relMatch[2],
          label: relMatch[4]
        });
      }
    });

    // Convert to ReactFlow nodes
    const flowNodes = Object.entries(classes).map(([className, classData], index) => {
      const x = (index % 3) * 300 + xPosition;
      const y = Math.floor(index / 3) * 200 + yPosition;
      
      return {
        id: className,
        type: 'classNode',
        position: { x, y },
        data: {
          id: className,
          label: className,
          attributes: classData.attributes,
          methods: classData.methods,
          onChange: handleNodeDataChange
        }
      };
    });

    // Convert to ReactFlow edges
    const flowEdges = relationships.map((rel, index) => ({
      id: `edge-${index}`,
      source: rel.from,
      target: rel.to,
      type: 'editableEdge',
      data: { 
        label: rel.label,
        onChange: handleEdgeDataChange
      },
      markerEnd: getMarkerType(rel.type)
    }));

    return { nodes: flowNodes, edges: flowEdges };
  };

  // Get marker type based on relationship
  const getMarkerType = (relType) => {
    switch (relType) {
      case '--|>':
      case '<|--':
        return { type: MarkerType.ArrowClosed };
      case '*--':
        return { type: MarkerType.Arrow };
      case 'o--':
        return { type: MarkerType.ArrowClosed };
      default:
        return { type: MarkerType.Arrow };
    }
  };

  // Handle node data changes
  const handleNodeDataChange = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Handle edge data changes
  const handleEdgeDataChange = useCallback((edgeId, newData) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            data: { ...edge.data, ...newData }
          };
        }
        return edge;
      })
    );
  }, [setEdges]);

  // Handle edge connection
  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      type: 'editableEdge',
      data: { label: 'association', onChange: handleEdgeDataChange }
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges, handleEdgeDataChange]);

  // Add new class node
  const addClass = () => {
    const newId = `Class${nodes.length + 1}`;
    const newNode = {
      id: newId,
      type: 'classNode',
      position: { x: Math.random() * 500, y: Math.random() * 300 },
      data: {
        id: newId,
        label: newId,
        attributes: ['attribute1'],
        methods: ['method1()'],
        onChange: handleNodeDataChange
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Delete selected node
  const deleteNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode));
      setSelectedNode(null);
    }
  };

  // Convert back to PlantUML
  const generatePlantUML = () => {
    let plantuml = '@startuml\n';
    
    // Add classes
    nodes.forEach(node => {
      plantuml += `class ${node.data.label} {\n`;
      
      // Add attributes
      if (node.data.attributes) {
        node.data.attributes.forEach(attr => {
          plantuml += `  +${attr}\n`;
        });
      }
      
      // Add separator if both attributes and methods exist
      if (node.data.attributes?.length > 0 && node.data.methods?.length > 0) {
        plantuml += '  --\n';
      }
      
      // Add methods
      if (node.data.methods) {
        node.data.methods.forEach(method => {
          plantuml += `  +${method}\n`;
        });
      }
      
      plantuml += '}\n\n';
    });
    
    // Add relationships
    edges.forEach(edge => {
      const label = edge.data?.label || '';
      plantuml += `${edge.source} --> ${edge.target}${label ? ' : ' + label : ''}\n`;
    });
    
    plantuml += '@enduml';
    return plantuml;
  };

  // Save diagram
  const saveDiagram = () => {
    const plantuml = generatePlantUML();
    if (onSave) {
      onSave(plantuml);
    }
  };

  const nodeTypes = {
    classNode: ClassNode
  };

  const edgeTypes = {
    editableEdge: EditableEdge
  };

  return (
    <div style={styles.editorContainer}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(event, node) => setSelectedNode(node.id)}
        onEdgeClick={(event, edge) => setSelectedEdge(edge.id)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Panel position="top-right" style={styles.panel}>
          <button onClick={addClass} style={styles.panelButton}>
            ➕ Add Class
          </button>
          <button onClick={deleteNode} style={styles.panelButton} disabled={!selectedNode}>
            🗑️ Delete Selected
          </button>
          <button onClick={saveDiagram} style={styles.saveButton}>
            💾 Save Diagram
          </button>
        </Panel>
        
        <MiniMap style={styles.minimap} />
        <Controls />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

// Wrapper component with provider
const DiagramEditorWrapper = (props) => {
  return (
    <ReactFlowProvider>
      <DiagramEditor {...props} />
    </ReactFlowProvider>
  );
};

// Styles
const styles = {
  editorContainer: {
    width: '100%',
    height: '600px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #dee2e6',
    marginTop: '10px'
  },
  classNode: {
    padding: '10px',
    borderRadius: '5px',
    border: '2px solid #333',
    backgroundColor: '#fff',
    minWidth: '150px',
    fontSize: '12px'
  },
  classHeader: {
    borderBottom: '1px solid #333',
    paddingBottom: '5px',
    marginBottom: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  classSection: {
    borderTop: '1px solid #333',
    paddingTop: '5px',
    marginTop: '5px'
  },
  sectionHeader: {
    fontSize: '10px',
    color: '#666',
    marginBottom: '3px'
  },
  attribute: {
    fontSize: '11px',
    padding: '2px 0'
  },
  method: {
    fontSize: '11px',
    padding: '2px 0'
  },
  handle: {
    width: '10px',
    height: '10px',
    backgroundColor: '#555'
  },
  editButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px'
  },
  input: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '12px'
  },
  smallInput: {
    flex: 1,
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '11px',
    marginRight: '4px'
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2px'
  },
  removeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '2px'
  },
  addButton: {
    width: '100%',
    padding: '4px',
    marginTop: '4px',
    fontSize: '10px',
    backgroundColor: '#e9ecef',
    border: '1px solid #ced4da',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  edgeInput: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '10px'
  },
  edgeLabel: {
    fontSize: '10px',
    fill: '#333',
    cursor: 'pointer',
    backgroundColor: 'white',
    padding: '2px 4px'
  },
  panel: {
    display: 'flex',
    gap: '10px',
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  panelButton: {
    padding: '8px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.3s'
  },
  saveButton: {
    padding: '8px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.3s'
  },
  minimap: {
    height: 120,
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6'
  }
};

export default DiagramEditorWrapper;