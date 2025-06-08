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
import EditableEdge from './EditableEdge';

const UMLDiagram = ({ initialNodes = [], initialEdges = [] }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState(initialEdges);

  // 🧠 Memoize node/edge types once
  const nodeTypes = useMemo(() => ({ editableNode: EditableNode }), []);
  const edgeTypes = useMemo(() => ({
    editable: (props) => <EditableEdge {...props} setEdges={setEdges} />,
  }), []);

  // 🔄 Shared node change handler
  const handleNodeChange = useCallback((id, updatedData) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                ...updatedData,
                onChange: handleNodeChange,
                id: node.id,
              },
            }
          : node
      )
    );
  }, []);

  // 🧩 Initialize nodes on mount
  React.useEffect(() => {
    setNodes(
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
  }, [initialNodes, handleNodeChange]);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        saveToBackend(updated, edges);
        return updated;
      });
    },
    [edges]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        saveToBackend(nodes, updated);
        return updated;
      });
    },
    [nodes]
  );

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        type: 'editable',
        data: { label: 'association' },
      };
      const updated = addEdge(newEdge, edges);
      setEdges(updated);
      saveToBackend(nodes, updated);
    },
    [edges, nodes]
  );

 const addNode = () => {
  const newId = `${Date.now()}`;
  const newNode = {
    id: newId,
    position: { x: Math.random() * 300, y: Math.random() * 300 },
    type: 'editableNode',
    data: {
      label: 'NewClass',
      attributes: [],
      id: newId,
      onChange: handleNodeChange,
    },
    sourcePosition: 'bottom',
    targetPosition: 'top',
    connectable: true,
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
        body: JSON.stringify({ nodes: nodesData, edges: edgesData }),
      });
      const result = await response.json();
      console.log('✅ Synced to backend:', result);
    } catch (err) {
      console.error('❌ Backend sync error:', err);
    }
  };

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
          type: 'editable',
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
        edgeTypes={edgeTypes}
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
