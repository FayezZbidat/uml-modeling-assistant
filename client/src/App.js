import { useState } from "react";
import plantumlEncoder from "plantuml-encoder";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator
} from "@chatscope/chat-ui-kit-react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [diagramType, setDiagramType] = useState("class");

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
      const backendUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

      const res = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          type: diagramType
        })
      });

      if (!res.ok) throw new Error("Server responded with " + res.status);

      const data = await res.json();
      const { plantuml, explanation } = data;
      
      const cleanedPlantUML = (plantuml || "").replace(/```(plantuml)?/g, '').trim();
      const diagramBlocks = cleanedPlantUML.match(/@startuml[\s\S]*?@enduml/g) || [];
      const encoded = diagramBlocks.map(block => plantumlEncoder.encode(block));

      const botMessage = {
        sender: "UMLBot",
        direction: "incoming",
        type: "custom",
        plantumlCode: cleanedPlantUML,
        diagramBlocks: diagramBlocks,
        encoded: encoded,
        content: (
          <div style={{ padding: "10px" }}>
            <p>{explanation || "❗ No explanation returned."}</p>
            
            <pre
              style={{
                background: "#0f172a",
                color: "#e0f2fe",
                padding: "10px",
                borderRadius: "6px",
                maxHeight: "300px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: "13px",
                textAlign: "left"
              }}
            >
              {cleanedPlantUML || "⚠️ No PlantUML code returned."}
            </pre>

            {encoded.length > 0 ? (
              <>
                {encoded.map((code, i) => (
                  <DiagramDisplay
                    key={i}
                    index={i}
                    code={code}
                    plantumlBlock={diagramBlocks[i]}
                    diagramType={diagramType}
                  />
                ))}
              </>
            ) : (
              <p style={{ color: "orange" }}>⚠️ No UML diagram blocks found.</p>
            )}
          </div>
        )
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      setMessages((prev) => [...prev, {
        message: `❌ Error: ${error.message}`,
        sender: "UMLBot",
        direction: "incoming",
        type: "text"
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f1f5f9",
        paddingTop: "20px"
      }}
    >
      <img
        src="/uml-technology-letter-logo.png"
        alt="UML Logo"
        style={{
          maxHeight: "150px",
          marginBottom: "10px",
          objectFit: "contain"
        }}
      />

      <div style={{ marginBottom: "10px" }}>
        <label htmlFor="diagram-select" style={{ marginRight: "10px", fontWeight: "bold" }}>
          Choose Diagram Type:
        </label>
        <select
          id="diagram-select"
          value={diagramType}
          onChange={(e) => setDiagramType(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            fontSize: "14px"
          }}
        >
          <option value="class">Class Diagram</option>
          <option value="usecase">Use Case Diagram</option>
          <option value="sequence">Sequence Diagram</option>
        </select>
      </div>

      <div
        style={{
          width: "90vw",
          height: "65vh",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          borderRadius: "10px",
          overflow: "hidden",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <MainContainer>
          <ChatContainer>
            <MessageList typingIndicator={isTyping ? <TypingIndicator content="UMLBot is typing..." /> : null}>
              {messages.map((msg, i) => (
                <Message
                  key={i}
                  model={{
                    message: msg.type === "custom" ? undefined : msg.message,
                    sender: msg.sender,
                    direction: msg.direction
                  }}
                >
                  {msg.type === "custom" && (
                    <Message.CustomContent>
                      {msg.content}
                    </Message.CustomContent>
                  )}
                </Message>
              ))}
            </MessageList>

            <MessageInput placeholder="Describe your system..." onSend={handleSend} />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}

// Separate component for each diagram
function DiagramDisplay({ index, code, plantumlBlock, diagramType }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(plantumlBlock);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleCodeChange = (e) => {
    setEditedCode(e.target.value);
  };

  const handleSave = () => {
    // Here you would update the diagram
    setIsEditing(false);
  };

  const currentCode = plantumlEncoder.encode(editedCode);

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ marginBottom: "10px", display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          onClick={handleEditToggle}
          style={{
            padding: "8px 16px",
            backgroundColor: isEditing ? "#dc3545" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          {isEditing ? '👁️ View Mode' : '✏️ Edit Mode'}
        </button>
        
        {isEditing && (
          <>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              💾 Save Changes
            </button>
            <span style={{ color: "#6c757d", fontSize: "13px" }}>
              Edit the PlantUML code below
            </span>
          </>
        )}
      </div>

      {isEditing ? (
        <div>
          <textarea
            value={editedCode}
            onChange={handleCodeChange}
            style={{
              width: "100%",
              height: "400px",
              padding: "10px",
              fontFamily: "monospace",
              fontSize: "13px",
              border: "2px solid #007bff",
              borderRadius: "8px",
              backgroundColor: "#f8f9fa"
            }}
          />
        </div>
      ) : (
        <div 
          style={{
            backgroundColor: "white",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ddd"
          }}
        >
          <iframe
            title={`uml-diagram-${index}`}
            src={`https://www.plantuml.com/plantuml/svg/${currentCode}`}
            width="100%"
            height="400px"
            style={{ 
              border: "none", 
              background: "#fff",
              display: "block"
            }}
          />
        </div>
      )}
      
      {/* Export buttons */}
      <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
        <button
          onClick={() => window.open(`https://www.plantuml.com/plantuml/png/${currentCode}`, '_blank')}
          style={{
            padding: "6px 12px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            cursor: "pointer"
          }}
        >
          📷 Export PNG
        </button>
        <button
          onClick={() => window.open(`https://www.plantuml.com/plantuml/svg/${currentCode}`, '_blank')}
          style={{
            padding: "6px 12px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            cursor: "pointer"
          }}
        >
          🎨 Export SVG
        </button>
        <button
          onClick={() => {
            const blob = new Blob([editedCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diagram-${index}.puml`;
            a.click();
          }}
          style={{
            padding: "6px 12px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            cursor: "pointer"
          }}
        >
          📄 Export PlantUML
        </button>
      </div>
    </div>
  );
}