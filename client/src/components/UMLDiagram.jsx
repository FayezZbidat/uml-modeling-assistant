import React, { useCallback, useState, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Controls,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';
import EditableNode from './EditableNode';

const UMLDiagram = ({ initialNodes = [], initialEdges = [] }) => {
  const [edges, setEdges] = useState(initialEdges);

  // Define handleNodeChange first
  const handleNodeChange = (id, { label, attributes }) => {
    const updated = nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, label, attributes, onChange: handleNodeChange } }
        : node
    );
    setNodes(updated);
    saveToBackend(updated, edges);
  };

 const [nodes, setNodes] = useState(
  initialNodes.map((n) => ({
    ...n,
    type: 'editableNode',
    data: {
      ...n.data,
      id: n.id, 
      attributes: n.data.attributes || [],
      onChange: handleNodeChange,
    },
  }))
);


  const nodeTypes = useMemo(() => ({ editableNode: EditableNode }), []);

  const onNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, nodes);
      setNodes(updated);
      saveToBackend(updated, edges);
    },
    [nodes, edges]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated);
      saveToBackend(nodes, updated);
    },
    [nodes, edges]
  );

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        data: { label: 'association' },
      };
      const updated = addEdge(newEdge, edges);
      setEdges(updated);
      saveToBackend(nodes, updated);
    },
    [edges, nodes]
  );

  const addNode = () => {
    const newNode = {
      id: `${Date.now()}`,
      position: { x: Math.random() * 250, y: Math.random() * 250 },
      type: 'editableNode',
      data: {
        label: 'NewClass',
        attributes: [],
        onChange: handleNodeChange,
      },
    };
    const updated = [...nodes, newNode];
    setNodes(updated);
    saveToBackend(updated, edges);
  };

  const deleteLastNode = () => {
    const updated = [...nodes];
    updated.pop();
    setNodes(updated);
    saveToBackend(updated, edges);
  };

  const saveToBackend = async (nodesData, edgesData) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/save-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodesData,
          edges: edgesData,
        }),
      });
      const result = await response.json();
      console.log('✅ Synced to backend:', result);
    } catch (err) {
      console.error('❌ Backend sync error:', err);
    }
  };

  console.log('🧪 All node IDs:', nodes.map((n) => n.id));
  console.log('🧪 All edge sources/targets:', edges.map((e) => [e.source, e.target]));

  return (
    <div style={{ height: '650px', borderRadius: '10px', background: '#fff', padding: '10px' }}>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={addNode} style={{ marginRight: '10px' }}>➕ Add Node</button>
        <button onClick={deleteLastNode}>🗑️ Delete Last Node</button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges.map((edge) => ({
          ...edge,
          label: edge.data?.label || '',
          style: { stroke: '#000' },
          labelStyle: { fontSize: 12, fill: '#000' },
          labelBgStyle: { fill: '#fff' },
          markerEnd: { type: 'arrowclosed', color: '#000' },
        }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background color="#eee" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default UMLDiagram;
