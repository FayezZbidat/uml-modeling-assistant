import { useState, useEffect, useRef } from "react";
import plantumlEncoder from "plantuml-encoder";

export default function App() {
  const [selectedPage, setSelectedPage] = useState("uml");
  const [umlText, setUmlText] = useState("");
  const [oclText, setOclText] = useState("");
  const [output, setOutput] = useState("");
  const [editableOutput, setEditableOutput] = useState("");
  const [model, setModel] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [diagramIndex, setDiagramIndex] = useState(0);

  const topRef = useRef(null);

  const handleSubmit = async () => {
    const endpoint = "/api/generate";
    const text = selectedPage === "uml" ? umlText : oclText;

    try {
      console.log("🚀 Sending to server:", text);
      const res = await fetch(`http://127.0.0.1:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("Server responded with " + res.status);

      const data = await res.json();
      console.log("✅ Server responded:", data);
      setOutput(data.plantuml || "No output generated.");
      setEditableOutput(data.plantuml || "");
      setModel(data.model || null);
      setDiagramIndex(0);

      setTimeout(() => {
        if (topRef.current) {
          topRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (error) {
      console.error("❌ Fetch error:", error);
      setOutput("❌ Fetch error: " + error.message);
      setEditableOutput("❌ Fetch error: " + error.message);
    }
  };

  const diagramBlocks = (editableOutput.match(/@startuml[\s\S]*?@enduml/g) || []);

  const handleNext = () => {
    setDiagramIndex((diagramIndex + 1) % diagramBlocks.length);
  };

  const handlePrevious = () => {
    setDiagramIndex((diagramIndex - 1 + diagramBlocks.length) % diagramBlocks.length);
  };

  return (
    <div style={{
      height: '100%',
      minHeight: '100vh',
      width: '100%',
      backgroundImage: 'url("/2.JPG")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      overflowY: 'auto',
    }}>
      <div ref={topRef}></div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          backgroundColor: '#1e293b',
          border: 'none',
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        <span style={{ fontSize: '20px', color: '#60a5fa' }}>{sidebarOpen ? "☰" : "☰"}</span>
      </button>

      {sidebarOpen && (
        <div style={{ width: '250px', background: '#1e293b', padding: '20px', position: 'fixed', top: 0, left: 0, height: '100%', boxShadow: '2px 0 5px rgba(0,0,0,0.2)', zIndex: 999 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', marginLeft: '40px', color: '#38bdf8' }}>SmartModeler</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li
              onClick={() => setSelectedPage("uml")}
              style={{ cursor: 'pointer', marginBottom: '10px', padding: '8px', backgroundColor: selectedPage === "uml" ? '#0ea5e9' : 'transparent', borderRadius: '4px' }}
            >
              🛠️ UML Generator
            </li>
            <li
              onClick={() => setSelectedPage("ocl")}
              style={{ cursor: 'pointer', padding: '8px', backgroundColor: selectedPage === "ocl" ? '#0ea5e9' : 'transparent', borderRadius: '4px' }}
            >
              📏 OCL Generator
            </li>
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <div style={{ width: '100%', maxWidth: '700px', padding: '20px', backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px', textAlign: 'center', color: '#f1f5f9' }}>
            {selectedPage === "uml" ? "Generate UML from Natural Language" : "Generate OCL Constraint"}
          </h1>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <textarea
              style={{ width: '100%', height: '100px', padding: '5px', border: '1px solid #334155', borderRadius: '6px', backgroundColor: '#0f172a', color: '#f1f5f9' }}
              placeholder={selectedPage === "uml" ? "Describe your UML requirement..." : "Describe your OCL requirement..."}
              value={selectedPage === "uml" ? umlText : oclText}
              onChange={(e) => selectedPage === "uml" ? setUmlText(e.target.value) : setOclText(e.target.value)}
            />
            <button
              onClick={handleSubmit}
              style={{ marginTop: '16px', backgroundColor: '#3b82f6', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
            >
              Generate
            </button>

            {editableOutput && (
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#a5f3fc', textAlign: 'center' }}>Customize UML Code</h2>
                <textarea
                  value={editableOutput}
                  onChange={(e) => setEditableOutput(e.target.value)}
                  style={{ width: '100%', height: '200px', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#e0f2fe', border: '1px solid #334155' }}
                />

                {diagramBlocks.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                    <iframe
                      title="UML Diagram"
                      src={`https://www.plantuml.com/plantuml/svg/${plantumlEncoder.encode(diagramBlocks[diagramIndex])}`}
                      style={{ width: '90%', height: '400px', border: 'none', background: '#fff' }}
                    />
                  </div>
                )}

                {diagramBlocks.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px' }}>
                    <button onClick={handlePrevious} style={{ background: '#334155', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none' }}>Previous</button>
                    <span style={{ paddingTop: '8px', color: '#cbd5e1' }}>{diagramIndex + 1} / {diagramBlocks.length}</span>
                    <button onClick={handleNext} style={{ background: '#334155', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none' }}>Next</button>
                  </div>
                )}
              </div>
            )}

            {model && (
              <div style={{ marginTop: '24px' }}>
                <h3>📦 Classes</h3>
                <ul>
                  {model.classes.map(cls => (
                    <li key={cls.name}>
                      <strong>{cls.name}</strong>: {cls.attributes.join(', ')}
                    </li>
                  ))}
                </ul>

                <h3>🔗 Relationships</h3>
                <ul>
                  {model.relationships.map((rel, i) => (
                    <li key={i}>
                      {rel.from} → {rel.to} ({rel.type}) {rel.label && `: ${rel.label}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
