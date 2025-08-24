import { useState, useEffect, useRef } from "react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator
} from "@chatscope/chat-ui-kit-react";
import UMLDiagram from "./components/UMLDiagram";
import DiagramExport from "./components/DiagramExport";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [diagramType, setDiagramType] = useState("class");
  const [diagrams, setDiagrams] = useState([]);
  const [currentDiagramId, setCurrentDiagramId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // NEW: for export
  const [showExport, setShowExport] = useState(false);
  const [plantumlCode, setPlantumlCode] = useState("");
  const diagramContainerRef = useRef();

  const umlRef = useRef();
  const backendUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

  // Fetch diagrams
  const fetchDiagrams = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/diagrams`);
      const data = await res.json();
      setDiagrams(data);
    } catch (err) {
      console.error("❌ Fetch diagrams failed:", err);
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, [backendUrl]);

  // Load diagram
  const loadDiagram = async (id) => {
    if (!id) return;
    const res = await fetch(`${backendUrl}/api/diagrams/${id}`);
    const data = await res.json();

    setCurrentDiagramId(id);
    setDiagramType(data.diagram_type);
    setPlantumlCode(data.plantuml_code); // ✅ store code for export
    umlRef.current?.loadFromPlantUML(data.plantuml_code);

    setMessages((prev) => [
      ...prev,
      {
        message: `✅ Loaded diagram: ${data.name}`,
        sender: "UMLBot",
        direction: "incoming",
        type: "text"
      }
    ]);
    setShowHistory(false);
  };

  // Delete diagram
  const deleteDiagram = async (id) => {
    if (!window.confirm("Delete this diagram?")) return;
    await fetch(`${backendUrl}/api/diagrams/${id}`, { method: "DELETE" });
    fetchDiagrams();
    if (id === currentDiagramId) setCurrentDiagramId(null);
  };

  // Save diagram
  const saveDiagram = async (plantumlCode) => {
    const now = new Date();
    const name = `Diagram ${now.toLocaleString()}`;
    const res = await fetch(`${backendUrl}/api/diagrams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        diagram_type: diagramType,
        plantuml_code: plantumlCode
      })
    });
    const data = await res.json();
    setCurrentDiagramId(data.id);
    fetchDiagrams();
  };

  // Handle AI send
  const handleSend = async (input) => {
    if (!input.trim()) return;
    const userMessage = {
      message: input,
      sender: "user",
      direction: "outgoing",
      type: "text"
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const res = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          type: diagramType,
          diagram_id: currentDiagramId
        })
      });
      if (!res.ok) throw new Error("Server responded with " + res.status);
      const data = await res.json();

      const plantuml = (data.plantuml || "")
        .replace(/```(plantuml)?/g, "")
        .trim();

      umlRef.current?.loadFromPlantUML(plantuml);
      setPlantumlCode(plantuml); // ✅ save code for export

      const botMessage = {
        sender: "UMLBot",
        direction: "incoming",
        type: "text",
        message: data.explanation || "Diagram updated!"
      };
      setMessages((prev) => [...prev, botMessage]);

      if (!currentDiagramId) await saveDiagram(plantuml);
      else {
        await fetch(`${backendUrl}/api/diagrams/${currentDiagramId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plantuml_code: plantuml,
            diagram_type: diagramType
          })
        });
        fetchDiagrams();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          message: `❌ Error: ${err.message}`,
          sender: "UMLBot",
          direction: "incoming",
          type: "text"
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, sans-serif" }}>
      {/* LEFT: Diagram + Toolbar */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", borderRight: "1px solid #e0e0e0" }}>
        {/* Toolbar */}
        <div
          style={{
            padding: "10px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            background: "#f8f9fa",
            flexWrap: "wrap"
          }}
        >
          {/* ✅ Diagram type selector */}
          <select
            value={diagramType}
            onChange={(e) => {
              setDiagramType(e.target.value);
              setCurrentDiagramId(null);
              umlRef.current?.loadFromPlantUML("");
              setPlantumlCode(""); // clear export code
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "13px"
            }}
          >
            <option value="class">📦 Class Diagram</option>
            <option value="usecase">🎭 Use Case Diagram</option>
            <option value="sequence">📑 Sequence Diagram</option>
          </select>

          {diagramType === "class" && (
            <button style={styles.toolbarBtn} onClick={() => umlRef.current?.addClass()}>
              ➕ Class
            </button>
          )}

          {diagramType === "usecase" && (
            <>
              <button style={styles.toolbarBtn} onClick={() => umlRef.current?.addActor()}>
                👤 Actor
              </button>
              <button style={styles.toolbarBtn} onClick={() => umlRef.current?.addUseCase()}>
                🎯 Use Case
              </button>
            </>
          )}

          {diagramType === "sequence" && (
            <button style={styles.toolbarBtn} onClick={() => umlRef.current?.addParticipant()}>
              👥 Participant
            </button>
          )}

          {/* Common buttons */}
          <button style={styles.toolbarBtn} onClick={() => umlRef.current?.deleteSelected()}>
            🗑️ Delete
          </button>

          {/* NEW: Export */}
          <button
            style={{ ...styles.toolbarBtn, background: "#28a745", color: "white" }}
            onClick={() => setShowExport(true)}
          >
            📤 Export
          </button>

          {/* History dropdown */}
          <div style={{ position: "relative" }}>
            <button
              style={{ ...styles.toolbarBtn, background: "#6c63ff", color: "white" }}
              onClick={() => setShowHistory(!showHistory)}
            >
              📜 History ▾
            </button>
            {showHistory && (
              <div style={styles.dropdown}>
                {diagrams.length === 0 && <div style={styles.emptyHistory}>No diagrams yet</div>}
                {diagrams.map((d) => (
                  <div key={d.id} style={styles.historyItem}>
                    <div style={{ flex: 1 }}>
                      <strong>{d.name}</strong>
                      <div style={{ fontSize: "11px", color: "#777" }}>
                        {new Date(d.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: "10px", color: "#999" }}>
                        Type: {d.diagram_type}
                      </div>
                    </div>
                    <button style={styles.historyBtn} onClick={() => loadDiagram(d.id)}>
                      Load
                    </button>
                    <button
                      style={{ ...styles.historyBtn, color: "red" }}
                      onClick={() => deleteDiagram(d.id)}
                    >
                      Del
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Diagram */}
        <div ref={diagramContainerRef} style={{ flex: 1, overflow: "hidden" }}>
          <UMLDiagram ref={umlRef} diagramId={currentDiagramId} diagramType={diagramType} />
        </div>
      </div>

      {/* RIGHT: Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <MainContainer>
          <ChatContainer>
            <MessageList typingIndicator={isTyping ? <TypingIndicator content="UMLBot is typing..." /> : null}>
              {messages.map((msg, i) => (
                <Message key={i} model={{ message: msg.message, sender: msg.sender, direction: msg.direction }} />
              ))}
            </MessageList>
            <MessageInput placeholder="Describe your system..." onSend={handleSend} />
          </ChatContainer>
        </MainContainer>
      </div>

      {/* Export Panel */}
      {showExport && (
        <DiagramExport
          plantumlCode={plantumlCode}
          diagramRef={diagramContainerRef}
          chatMessages={messages}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

const styles = {
  toolbarBtn: {
    padding: "6px 10px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
    background: "white",
    transition: "all 0.2s"
  },
  dropdown: {
    position: "absolute",
    top: "110%",
    right: 0,
    width: "280px",
    maxHeight: "300px",
    overflowY: "auto",
    background: "white",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    zIndex: 10,
    padding: "8px"
  },
  historyItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "13px"
  },
  historyBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: "12px",
    marginLeft: "4px"
  },
  emptyHistory: {
    textAlign: "center",
    color: "#888",
    fontSize: "12px",
    padding: "10px"
  }
};
