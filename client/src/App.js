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
  const [diagramType, setDiagramType] = useState("class"); // סוג הדיאגרמה

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
          type: diagramType // שליחת סוג הדיאגרמה
        })
      });

      if (!res.ok) throw new Error("Server responded with " + res.status);

      const data = await res.json();
      const { plantuml, explanation } = data;
      // bayan added here
      // 🧼 Clean triple backticks from GPT responses
      const cleanedPlantUML = (plantuml || "").replace(/```(plantuml)?/g, '').trim();

      // 🧱 Extract valid PlantUML blocks
      const diagramBlocks = cleanedPlantUML.match(/@startuml[\s\S]*?@enduml/g) || [];

      // 🔐 Safely encode each one
      const encoded = diagramBlocks.map(block => plantumlEncoder.encode(block));


      const botMessage = {
        sender: "UMLBot",
        direction: "incoming",
        type: "custom",
        content: (
          <div style={{ padding: "10px" }}>
            <p>{explanation || "❗ No explanation returned."}</p>
            {/* bayan added here – made diagram block scrollable to fix layout issues with long outputs */}
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
            {plantuml || "⚠️ No PlantUML code returned."}
            </pre>

            {encoded.length > 0 ? encoded.map((code, i) => (
              <iframe
                key={i}
                title={`uml-diagram-${i}`}
                src={`https://www.plantuml.com/plantuml/svg/${code}`}
                width="100%"
                height="300px"
                style={{ border: "none", background: "#fff", marginTop: "10px" }}
              />
            )) : <p style={{ color: "orange" }}>⚠️ No UML diagram blocks found.</p>}
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
      {/* 🔰 לוגו בראש הדף */}
      <img
        src="/uml-technology-letter-logo.png"
        alt="UML Logo"
        style={{
          maxHeight: "150px",
          marginBottom: "10px",
          objectFit: "contain"
        }}
      />

      {/* ✅ תיבת בחירה מתחת ללוגו */}
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

      {/* 🔲 ממשק הצ'אט */}
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

            {/* 💬 רשימת הודעות */}
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

            {/* 📝 שורת הקלדה */}
            <MessageInput placeholder="Describe your system..." onSend={handleSend} />

          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}
