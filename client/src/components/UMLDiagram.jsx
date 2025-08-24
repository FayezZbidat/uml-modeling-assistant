import React, {
  useCallback,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useEffect
} from "react";
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Controls,
  Background
} from "reactflow";
import "reactflow/dist/style.css";
import EditableNode from "./EditableNode";
import EditableEdge from "./EditableEdge";
import ActorNode from "./ActorNode";
import UseCaseNode from "./UseCaseNode";
import ParticipantNode from "./ParticipantNode";

// ✅ Layout algorithms
const layoutAlgorithms = {
  class: (nodes, edges) => {
    const updatedNodes = [...nodes];
    const centerX = 500, centerY = 300;
    const spacingX = 250, spacingY = 200;

    updatedNodes.forEach((node, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      node.position = {
        x: centerX + (col - 1) * spacingX,
        y: centerY + row * spacingY
      };
    });

    return updatedNodes;
  },

  usecase: (nodes, edges) => {
    const updatedNodes = [...nodes];
    const centerX = 500, centerY = 300, radius = 200;

    const actors = updatedNodes.filter(n => n.type === "actorNode");
    const useCases = updatedNodes.filter(n => n.type === "useCaseNode");

    actors.forEach((actor, index) => {
      actor.position = {
        x: centerX + (index - (actors.length - 1) / 2) * 150,
        y: centerY - 150
      };
    });

    useCases.forEach((uc, index) => {
      const angle = (index / (useCases.length - 1 || 1)) * Math.PI;
      uc.position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle) * 0.5
      };
    });

    return updatedNodes;
  },

  sequence: (nodes, edges) => {
    const updatedNodes = [...nodes];
    const startX = 100, spacingX = 200;

    updatedNodes.forEach((node, index) => {
      node.position = { x: startX + index * spacingX, y: 100 };
    });

    const updatedEdges = [...edges];
    updatedEdges.forEach((edge, index) => {
      edge.data = edge.data || {};
      edge.data.yOffset = 150 + index * 50;
    });

    return { nodes: updatedNodes, edges: updatedEdges };
  }
};

const UMLDiagram = forwardRef((props, ref) => {
  const { diagramId, diagramType = "class" } = props;
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedElements, setSelectedElements] = useState({ nodes: [], edges: [] });

  // ✅ Node/Edge types
  const nodeTypes = useMemo(() => ({
    editableNode: EditableNode,
    actorNode: ActorNode,
    useCaseNode: UseCaseNode,
    participantNode: ParticipantNode
  }), []);

  const edgeTypes = useMemo(() => ({
    editable: (props) => <EditableEdge {...props} setEdges={setEdges} />
  }), []);

  // ✅ Inline edit handler
  const handleNodeChange = useCallback((id, updatedData) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === id ? { ...node, data: { ...node.data, ...updatedData } } : node
      )
    );
  }, []);

  // ✅ Parser
  function parsePlantUML(plantuml, diagramType = "class") {
    const nodes = [];
    const edges = [];
    const lines = plantuml.split("\n");

    if (diagramType === "class") {
      let currentClass = null;
      lines.forEach((line) => {
        const trimmed = line.trim();
        const classMatch = trimmed.match(/^class\s+(\w+)/);
        if (classMatch) {
          currentClass = classMatch[1];
          nodes.push({
            id: currentClass,
            type: "editableNode",
            data: {
              label: currentClass,
              attributes: [],
              id: currentClass,
              diagramType: "class",
              onChange: handleNodeChange
            }
          });
          return;
        }
        if (currentClass && trimmed.startsWith("+")) {
          const attr = trimmed.substring(1).trim();
          const node = nodes.find(n => n.id === currentClass);
          if (node) node.data.attributes.push(attr);
        }
        const relMatch = trimmed.match(/(\w+)\s*(--|->|\.\.>|<\|--|--\|>|\*--|o--)\s*(\w+)(?:\s*:\s*(.*))?/);
        if (relMatch) {
          edges.push({
            id: `edge-${edges.length}`,
            source: relMatch[1],
            target: relMatch[3],
            type: "editable",
            data: { label: relMatch[4] || relMatch[2], originalArrowType: relMatch[2] }
          });
        }
      });
    } else if (diagramType === "usecase") {
      lines.forEach((line) => {
        const trimmed = line.trim();
        const actorMatch = trimmed.match(/^actor\s+"?([^"\s]+)"?/);
        if (actorMatch) {
          nodes.push({
            id: actorMatch[1],
            type: "actorNode",
            data: {
              label: actorMatch[1],
              diagramType: "usecase",
              onChange: handleNodeChange
            }
          });
          return;
        }
        const useCaseMatch = trimmed.match(/(?:usecase|\(uc\))\s+"?([^"]+)"?\s+(?:as\s+)?(\w+)/);
        if (useCaseMatch) {
          const label = useCaseMatch[1].trim();
          const id = useCaseMatch[2] || label.replace(/\s+/g, "_");
          nodes.push({
            id,
            type: "useCaseNode",
            data: {
              label,
              diagramType: "usecase",
              onChange: handleNodeChange
            }
          });
          return;
        }
        const relMatch = trimmed.match(/(\w+)\s*(-->|->)\s*(\w+)(?:\s*:\s*(.*))?/);
        if (relMatch) {
          edges.push({
            id: `edge-${edges.length}`,
            source: relMatch[1],
            target: relMatch[3],
            type: "editable",
            data: { label: relMatch[4] || relMatch[2] }
          });
        }
      });
    } else if (diagramType === "sequence") {
      const participants = new Map();
      lines.forEach((line) => {
        const trimmed = line.trim();
        const participantMatch = trimmed.match(/^participant\s+"?([^"\s]+)"?(?:\s+as\s+(\w+))?/);
        if (participantMatch) {
          const label = participantMatch[1];
          const id = participantMatch[2] || label.replace(/\s+/g, "_");
          participants.set(id, { label });
          nodes.push({
            id,
            type: "participantNode",
            data: {
              label,
              diagramType: "sequence",
              onChange: handleNodeChange
            }
          });
          return;
        }
        const actorMatch = trimmed.match(/^actor\s+"?([^"\s]+)"?/);
        if (actorMatch) {
          const label = actorMatch[1];
          const id = label.replace(/\s+/g, "_");
          participants.set(id, { label });
          nodes.push({
            id,
            type: "participantNode",
            data: {
              label,
              diagramType: "sequence",
              onChange: handleNodeChange
            }
          });
          return;
        }
        const messageMatch = trimmed.match(/(\w+)\s*(->|-->)\s*(\w+)\s*:\s*(.+)/);
        if (messageMatch) {
          edges.push({
            id: `edge-${edges.length}`,
            source: messageMatch[1],
            target: messageMatch[3],
            type: "editable",
            data: { label: messageMatch[4] }
          });
        }
      });
    }

    const layoutResult = layoutAlgorithms[diagramType](nodes, edges);
    return Array.isArray(layoutResult) ? { nodes: layoutResult, edges } : layoutResult;
  }

  // ✅ Selection
  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }) => {
    setSelectedElements({ nodes: selectedNodes, edges: selectedEdges });
  }, []);

  const deleteSelected = useCallback(() => {
    const selectedNodeIds = selectedElements.nodes.map(n => n.id);
    const selectedEdgeIds = selectedElements.edges.map(e => e.id);

    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      alert("Please select an element to delete");
      return;
    }

    setNodes(prev => prev.filter(node => !selectedNodeIds.includes(node.id)));
    setEdges(prev => prev.filter(edge => !selectedEdgeIds.includes(edge.id)));
    setSelectedElements({ nodes: [], edges: [] });
  }, [selectedElements]);

  // ✅ Save to backend
  const saveToBackend = useCallback(
    async (nodesData, edgesData) => {
      if (!diagramId) return;
      try {
        await fetch(
          `http://127.0.0.1:5000/api/diagrams/${diagramId}/save-model`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodes: nodesData, edges: edgesData })
          }
        );
      } catch (err) {
        console.error("❌ Backend sync error:", err);
      }
    },
    [diagramId]
  );

  const onNodesChange = useCallback(
    (changes) =>
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        saveToBackend(updated, edges);
        return updated;
      }),
    [edges, saveToBackend]
  );

  const onEdgesChange = useCallback(
    (changes) =>
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        saveToBackend(nodes, updated);
        return updated;
      }),
    [nodes, saveToBackend]
  );

  const onConnect = useCallback(
    (params) => {
      const newEdge = { ...params, type: "editable", data: { label: "association" } };
      setEdges((eds) => {
        const updated = addEdge(newEdge, eds);
        saveToBackend(nodes, updated);
        return updated;
      });
    },
    [nodes, saveToBackend]
  );

  const loadFromPlantUML = useCallback((plantuml) => {
    setIsTyping(true);
    try {
      const { nodes, edges } = parsePlantUML(plantuml, diagramType);
      setNodes(nodes);
      setEdges(edges);
      if (nodes.length > 0) saveToBackend(nodes, edges);
    } catch (error) {
      console.error("Error parsing PlantUML:", error);
    } finally {
      setIsTyping(false);
    }
  }, [diagramType, saveToBackend]);

  const applyLayout = useCallback(() => {
    const layoutResult = layoutAlgorithms[diagramType](nodes, edges);
    if (Array.isArray(layoutResult)) {
      setNodes(layoutResult);
    } else {
      setNodes(layoutResult.nodes);
      setEdges(layoutResult.edges);
    }
  }, [nodes, edges, diagramType]);

  useImperativeHandle(ref, () => ({
    addClass() {
      if (diagramType !== "class") return;
      const newId = `Class${Date.now()}`;
      setNodes((prev) => {
        const updated = [
          ...prev,
          {
            id: newId,
            type: "editableNode",
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
              label: newId,
              attributes: [],
              id: newId,
              diagramType: "class",
              onChange: handleNodeChange
            }
          }
        ];
        const layoutResult = layoutAlgorithms.class(updated, edges);
        saveToBackend(layoutResult, edges);
        return layoutResult;
      });
    },

    addActor() {
      if (diagramType !== "usecase") return;
      const newId = `Actor${Date.now()}`;
      setNodes((prev) => {
        const updated = [
          ...prev,
          {
            id: newId,
            type: "actorNode",
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
              label: newId,
              diagramType: "usecase",
              onChange: handleNodeChange
            }
          }
        ];
        const layoutResult = layoutAlgorithms.usecase(updated, edges);
        saveToBackend(layoutResult, edges);
        return layoutResult;
      });
    },

    addUseCase() {
      if (diagramType !== "usecase") return;
      const newId = `UseCase${Date.now()}`;
      setNodes((prev) => {
        const updated = [
          ...prev,
          {
            id: newId,
            type: "useCaseNode",
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
              label: newId,
              diagramType: "usecase",
              onChange: handleNodeChange
            }
          }
        ];
        const layoutResult = layoutAlgorithms.usecase(updated, edges);
        saveToBackend(layoutResult, edges);
        return layoutResult;
      });
    },

    addParticipant() {
      if (diagramType !== "sequence") return;
      const newId = `Participant${Date.now()}`;
      setNodes((prev) => {
        const updated = [
          ...prev,
          {
            id: newId,
            type: "participantNode",
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
              label: newId,
              diagramType: "sequence",
              onChange: handleNodeChange
            }
          }
        ];
        const layoutResult = layoutAlgorithms.sequence(updated, edges);
        saveToBackend(layoutResult.nodes, layoutResult.edges);
        return layoutResult.nodes;
      });
    },

    deleteSelected,
    loadFromPlantUML,
    applyLayout
  }), [diagramType, handleNodeChange, edges, saveToBackend, loadFromPlantUML, applyLayout, deleteSelected]);

  // ✅ Empty state
  if (nodes.length === 0 && !isTyping) {
    return (
      <div style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        color: "#666",
        fontSize: "16px",
        textAlign: "center",
        padding: "20px"
      }}>
        No diagram to display. Describe your system in the chat!
        <br />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", position: "relative" }}>
      {isTyping && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        }}>
          ⏳ Generating diagram...
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        selectNodesOnDrag={false}
        selectionMode="partial"
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
});

export default UMLDiagram;
