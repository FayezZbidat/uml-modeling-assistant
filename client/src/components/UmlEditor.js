import React, { useCallback, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

export default function UmlEditor({ initialModel, onModelChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load initial model
  useState(() => {
    const classNodes = initialModel.classes.map((cls, i) => ({
      id: cls.name,
      position: { x: i * 200, y: 100 },
      data: { label: `${cls.name}\n${cls.attributes.join('\n')}` },
      type: 'default',
    }));
    const relationshipEdges = initialModel.relationships.map((rel, i) => ({
      id: `e${i}`,
      source: rel.from,
      target: rel.to,
      label: rel.label || '',
      type: 'smoothstep',
    }));
    setNodes(classNodes);
    setEdges(relationshipEdges);
  }, [initialModel]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          onModelChange?.({ nodes, edges });
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
