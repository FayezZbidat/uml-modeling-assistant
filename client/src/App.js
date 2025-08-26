// =============================
// FILE: src/App.js  (single-file hotfix)
// =============================
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import { FiDownload, FiCopy, FiExternalLink, FiX, FiFileText,
  FiPlus, FiSave, FiDownloadCloud, FiRotateCcw, FiRotateCw, FiTrash2,
  FiType, FiGitCommit, FiChevronDown, FiChevronUp, FiClock, FiBox,
  FiUser, FiTarget, FiUsers, FiLink2, FiScissors } from "react-icons/fi";
import plantumlEncoder from "plantuml-encoder";

/* ----------------------------------------
   Utils (PlantUML helpers)
----------------------------------------- */
function ensureWrapped(code) {
  const c = (code || "").trim();
  if (!c) return "@startuml\n@enduml";
  if (!c.includes("@startuml")) return `@startuml\n${c}\n@enduml`;
  return c.replace(/\s+$/, "");
}
function appendSnippet(prev, snippet) {
  const base = ensureWrapped(prev);
  return base.replace(/@enduml\s*$/i, `${snippet}\n@enduml`);
}
function sanitize(s) { return String(s || "").replace(/[^A-Za-z0-9_]/g, "_"); }
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function addClassSnippet(name = "Class") {
  const safe = sanitize(name);
  return `\nclass ${safe} {\n  +id: int\n  +name: String\n  +save(): void\n}`;
}
function addActorSnippet(name = "Actor") { return `\nactor ${sanitize(name)}`; }
function addUseCaseSnippet(label = "Use Case", alias = "UC1") {
  const a = sanitize(alias);
  const lbl = label.replace(/"/g, '\\"');
  return `\nusecase "${lbl}" as ${a}`;
}
function addParticipantSnippet(name = "P1") { return `\nparticipant ${sanitize(name)}`; }
function addMessageSnippet(from = "A", to = "B", text = "msg") {
  const f = sanitize(from), t = sanitize(to);
  const lbl = (text || "").replace(/\n/g, " ");
  return `\n${f} -> ${t} : ${lbl}`;
}
function addAssociationSnippet(diagramType, a = "A", b = "B", label = "", arrow = "-->") {
  const A = sanitize(a), B = sanitize(b);
  const lbl = label ? ` : ${label.replace(/\n/g, " ")}` : "";
  if (diagramType === "usecase") return `\n${A} ${arrow} ${B}${lbl}`;
  return `\n${A} -- ${B}${lbl}`;
}
function renameAll(code, oldName, newName) {
  let c = ensureWrapped(code);
  const re = new RegExp(`\\b${escapeRegExp(sanitize(oldName))}\\b`, "g");
  return c.replace(re, sanitize(newName));
}
function deleteObjectFromCode(code, name /*, diagramType */) {
  let c = ensureWrapped(code);
  const safe = sanitize(name);
  // Remove class block
  c = c.replace(new RegExp(`\\nclass\\s+${escapeRegExp(safe)}\\s*\\{[\\s\\S]*?\\}\\n?`, "g"), "\n");
  // Remove lines containing the name (keep start/end markers)
  c = c.replace(/^.*\b(.+)?\b.*$\n?/gm, (line) => {
    if (/@startuml|@enduml/.test(line)) return line;
    if (new RegExp(`\\b${escapeRegExp(safe)}\\b`).test(line)) return "";
    return line;
  });
  return c;
}
function updateClassBlock(code, className, attributesArr = [], methodsArr = []) {
  let c = ensureWrapped(code);
  const name = sanitize(className);
  const blockRe = new RegExp(`(class\\s+${escapeRegExp(name)}\\s*\\{)[\\s\\S]*?(\\})`, "m");
  const attrLines = attributesArr.map((a) => a.trim()).filter(Boolean).join("\n  ");
  const methodLines = methodsArr.map((m) => m.trim()).filter(Boolean).join("\n  ");
  const newBlock = `class ${name} {\n  ${attrLines}${attrLines && methodLines ? "\n  " : ""}${methodLines}\n}`;
  if (blockRe.test(c)) c = c.replace(blockRe, newBlock);
  else c = appendSnippet(c, `\n${newBlock}`);
  return c;
}
function findClassBlock(c, name) {
  const re = new RegExp(`class\\s+${escapeRegExp(name)}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const m = c.match(re);
  return m ? m[1] : null;
}
function extractEntities(code /*, diagramType */) {
  const c = ensureWrapped(code);
  const classes = Array.from(c.matchAll(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)).map((m) => m[1]);
  const classMap = {};
  classes.forEach((nm) => {
    const block = findClassBlock(c, nm) || "";
    classMap[nm] = {
      attributes: Array.from(block.matchAll(/^[ \t]*([+\-#]?[A-Za-z_][A-Za-z0-9_]*\s*:\s*[^\n]+)$/gm)).map((m) => m[1].trim()),
      methods: Array.from(block.matchAll(/^[ \t]*([+\-#]?[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*:?\s*[^\n]*?)$/gm)).map((m) => m[1].trim()),
    };
  });
  const actors = Array.from(c.matchAll(/\bactor\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)).map((m) => m[1]);
  const usecases = Array.from(c.matchAll(/\busecase\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)/g)).map((m) => m[2]);
  const participants = Array.from(c.matchAll(/\bparticipant\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)).map((m) => m[1]);
  return { classes, classMap, actors, usecases, participants };
}

/* ----------------------------------------
   PlantUMLViewer (inline)
----------------------------------------- */
const PlantUMLViewer = ({ code }) => {
  const encodedUrl = useMemo(() => {
    const payload = code && code.includes("@startuml") ? code : "@startuml\n@enduml";
    const enc = plantumlEncoder.encode(payload);
    return `https://www.plantuml.com/plantuml/svg/${enc}`;
  }, [code]);

  if (!code) {
    return <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>No diagram yet</div>;
  }
  return (
    <div style={{ textAlign: "center", height: "100%", overflow: "auto", padding: 16 }}>
      <img
        src={encodedUrl}
        alt="UML Diagram"
        data-diagram="uml"
        crossOrigin="anonymous"
        style={{ maxWidth: "100%", height: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}
      />
    </div>
  );
};

/* ----------------------------------------
   DiagramExport (inline)
----------------------------------------- */
const DiagramExport = ({ plantumlCode, diagramSelector, chatMessages, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("png");
  const [exportStatus, setExportStatus] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    quality: "high",
    background: "#ffffff",
    fileName: "uml-diagram",
  });

  const getFileName = (ext) => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    return `${exportSettings.fileName}-${ts}.${ext}`;
  };
  const showStatus = (message, isError = false) => {
    setExportStatus(message);
    setTimeout(() => setExportStatus(""), 3000);
    if (isError) console.error(message);
  };
  const captureTarget = () => document.querySelector(diagramSelector);

  const exportAsPNG = async () => {
    try {
      const target = captureTarget();
      if (!target) return showStatus("No diagram element found", true);
      setIsExporting(true);
      const scale = exportSettings.quality === "high" ? 3 : exportSettings.quality === "medium" ? 2 : 1;
      const canvas = await html2canvas(target, { backgroundColor: exportSettings.background, scale, useCORS: true, logging: false });
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, getFileName("png"));
        showStatus("PNG exported ✅");
      });
    } catch (e) {
      showStatus("Failed to export PNG: " + e.message, true);
    } finally {
      setIsExporting(false);
    }
  };
  const exportAsPDF = async () => {
    try {
      const target = captureTarget();
      if (!target) return showStatus("No diagram element found", true);
      setIsExporting(true);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.setProperties({ title: exportSettings.fileName, subject: "UML Diagram Export", author: "UML Modeling Assistant", creator: "UML Modeling Assistant" });
      const canvas = await html2canvas(target, { backgroundColor: exportSettings.background, scale: 2, logging: false, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
      // code page
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.text("PlantUML Source Code", 20, 20);
      pdf.setFontSize(9);
      pdf.setFont("courier", "normal");
      let y = 30;
      const lines = (plantumlCode || "@startuml\n@enduml").split("\n");
      lines.forEach((line) => {
        if (y > pageHeight - 15) { pdf.addPage(); y = 15; }
        const wrapped = pdf.splitTextToSize(line, pageWidth - 40);
        wrapped.forEach((w) => { pdf.text(w, 20, y); y += 5; });
      });
      pdf.save(getFileName("pdf"));
      showStatus("PDF exported ✅");
    } catch (e) {
      showStatus("Failed to export PDF: " + e.message, true);
    } finally {
      setIsExporting(false);
    }
  };
  const handleExport = () => (exportFormat === "pdf" ? exportAsPDF() : exportAsPNG());
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(plantumlCode || ""); showStatus("PlantUML code copied ✅"); }
    catch { showStatus("Copy failed", true); }
  };
  const openOnline = () => {
    try { const enc = plantumlEncoder.encode(plantumlCode || "@startuml\n@enduml"); window.open(`https://www.plantuml.com/plantuml/svg/${enc}`, "_blank"); }
    catch { showStatus("Open online failed", true); }
  };

  const styles = {
    container: { padding: 20, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, margin: 16, boxShadow: "0 8px 20px rgba(0,0,0,.06)", maxWidth: 720 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #eef2f7" },
    title: { fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 },
    row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 },
    select: { padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", minWidth: 140 },
    btn: { padding: "10px 16px", background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
    ghost: { padding: "10px 12px", background: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
    status: { marginTop: 10, padding: 10, borderRadius: 8, textAlign: "center", background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd" },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Export Diagram</h3>
        <button onClick={onClose} style={styles.ghost} title="Close"><FiX size={18} /></button>
      </div>

      <div style={styles.row}>
        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={styles.select} disabled={isExporting}>
          <option value="png">PNG Image</option>
          <option value="pdf">PDF Document</option>
        </select>
        <button onClick={handleExport} style={styles.btn} disabled={isExporting}><FiDownload /> {isExporting ? "Exporting..." : "Export"}</button>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={styles.ghost}>⚙️ Settings</button>
      </div>

      {showAdvanced && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={styles.row}>
            <label>Quality</label>
            <select value={exportSettings.quality} onChange={(e) => setExportSettings({ ...exportSettings, quality: e.target.value })} style={styles.select}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <label>Background</label>
            <input type="color" value={exportSettings.background} onChange={(e) => setExportSettings({ ...exportSettings, background: e.target.value })} />
            <label>File name</label>
            <input value={exportSettings.fileName} onChange={(e) => setExportSettings({ ...exportSettings, fileName: e.target.value })} style={{ ...styles.select, minWidth: 220 }} />
          </div>
        </div>
      )}

      <div style={styles.row}>
        <button onClick={copyCode} style={styles.ghost}><FiCopy /> Copy PlantUML</button>
        <button onClick={openOnline} style={styles.ghost}><FiExternalLink /> Open Online</button>
        <button
          onClick={() => {
            try {
              if (!chatMessages || chatMessages.length === 0) return showStatus("No chat messages", true);
              let text = `UML Modeling Assistant - Chat Log\n`;
              text += `Generated: ${new Date().toLocaleString()}\n`;
              text += `========================================\n\n`;
              chatMessages.forEach((m) => {
                const sender = m.sender === "user" ? "You" : "UMLBot";
                text += `${sender}: ${m.message}\n`;
              });
              const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              saveAs(blob, getFileName("txt"));
              showStatus("Chat exported ✅");
            } catch (e) {
              showStatus("Export chat failed: " + e.message, true);
            }
          }}
          style={styles.ghost}
        >
          <FiFileText /> Export Chat
        </button>
      </div>

      {exportStatus && <div style={styles.status}>{exportStatus}</div>}
    </div>
  );
};

/* ----------------------------------------
   ProToolbar (inline)
----------------------------------------- */
function Divider() { return <div style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch", margin: "0 8px" }} />; }

const ProToolbar = ({
  diagramType, setDiagramType, onSave, onUndo, onRedo, canUndo, canRedo, onOpenHistory,
  selectedName, selectedType, setSelectedName, setSelectedType, entities,
  addClass, addActor, addUseCase, addParticipant, addMessage, addAssociation,
  onRename, onDelete, onEditClass, onExport,
}) => {
  const [openDetails, setOpenDetails] = useState(true);
  const [tmpName, setTmpName] = useState("");
  const [attrText, setAttrText] = useState("");
  const [methodText, setMethodText] = useState("");
  const [relFrom, setRelFrom] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relLabel, setRelLabel] = useState("");

  const palette = {
    bar: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: 12, borderBottom: "1px solid #e5e7eb", background: "#ffffff" },
    group: { display: "flex", gap: 8, alignItems: "center" },
    select: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff" },
    btn: { padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
    primary: { padding: "8px 12px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
    panel: { padding: 12, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
    field: { padding: 8, border: "1px solid #d1d5db", borderRadius: 8, width: 220 },
    textarea: { padding: 8, border: "1px solid #d1d5db", borderRadius: 8, width: 320, minHeight: 64 },
    label: { fontSize: 12, color: "#6b7280" },
    sectionTitle: { fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6 },
  };

  const objectOptions = useMemo(() => {
    const opts = [];
    if (diagramType === "class") (entities.classes || []).forEach((c) => opts.push({ label: c, type: "class" }));
    if (diagramType === "usecase") {
      (entities.actors || []).forEach((a) => opts.push({ label: a, type: "actor" }));
      (entities.usecases || []).forEach((u) => opts.push({ label: u, type: "usecase" }));
    }
    if (diagramType === "sequence") (entities.participants || []).forEach((p) => opts.push({ label: p, type: "participant" }));
    return opts;
  }, [entities, diagramType]);

  const onSelectObject = (val) => {
    const found = objectOptions.find((o) => o.label === val);
    setSelectedName(val || "");
    setSelectedType(found?.type || null);
    setTmpName(val || "");
    if (found?.type === "class") {
      setAttrText((entities.classMap?.[val]?.attributes || []).join("\n"));
      setMethodText((entities.classMap?.[val]?.methods || []).join("\n"));
    } else {
      setAttrText("");
      setMethodText("");
    }
  };

  return (
    <>
      <div style={palette.bar}>
        <div style={palette.group}>
          <span style={palette.sectionTitle}>Diagram</span>
          <select value={diagramType} onChange={(e) => setDiagramType(e.target.value)} style={palette.select}>
            <option value="class">📦 Class</option>
            <option value="usecase">🎭 Use Case</option>
            <option value="sequence">📑 Sequence</option>
          </select>
        </div>

        <Divider />

        <div style={palette.group}>
          <span style={palette.sectionTitle}>Insert</span>
          {diagramType === "class" && (<button style={palette.btn} onClick={() => addClass(`Class${Date.now() % 1000}`)}><FiBox /> Class</button>)}
          {diagramType === "usecase" && (
            <>
              <button style={palette.btn} onClick={() => addActor(`Actor${Date.now() % 1000}`)}><FiUser /> Actor</button>
              <button style={palette.btn} onClick={() => addUseCase(`Use Case ${Date.now() % 1000}`, `UC${Date.now() % 1000}`)}><FiTarget /> Use Case</button>
            </>
          )}
          {diagramType === "sequence" && (<button style={palette.btn} onClick={() => addParticipant(`P${Date.now() % 1000}`)}><FiUsers /> Participant</button>)}
        </div>

        <div style={palette.group}>
          <span style={palette.sectionTitle}>Link</span>
          {diagramType !== "sequence" ? (
            <button style={palette.btn} onClick={() => addAssociation(selectedName || "A", "B", "") }><FiLink2 /> Assoc.</button>
          ) : (
            <button style={palette.btn} onClick={() => addMessage(selectedName || "A", "B", "msg") }><FiGitCommit /> Message</button>
          )}
        </div>

        <Divider />

        <div style={palette.group}>
          <button style={palette.btn} onClick={() => setOpenDetails((s) => !s)}>{openDetails ? <FiChevronUp /> : <FiChevronDown />} Details</button>
          <button style={palette.btn} onClick={onUndo} disabled={!canUndo}><FiRotateCcw /> Undo</button>
          <button style={palette.btn} onClick={onRedo} disabled={!canRedo}><FiRotateCw /> Redo</button>
          <button style={palette.primary} onClick={onSave}><FiSave /> Save</button>
          <button style={palette.btn} onClick={onExport}><FiDownloadCloud /> Export</button>
          <button style={palette.btn} onClick={onOpenHistory}><FiClock /> History</button>
        </div>
      </div>

      {openDetails && (
        <div style={palette.panel}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={palette.label}>Select object</div>
              <select value={selectedName} onChange={(e) => onSelectObject(e.target.value)} style={palette.field}>
                <option value="">— none —</option>
                {objectOptions.map((o) => (<option key={`${o.type}:${o.label}`} value={o.label}>{o.label} ({o.type})</option>))}
              </select>
            </div>

            <div>
              <div style={palette.label}>Rename</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={tmpName} onChange={(e) => setTmpName(e.target.value)} placeholder="New name" style={palette.field} />
                <button style={palette.btn} onClick={() => onRename(selectedName, tmpName)} disabled={!selectedName || !tmpName}><FiType /> Apply</button>
                <button style={{ ...palette.btn, borderColor: "#fecaca", color: "#b91c1c" }} onClick={() => onDelete(selectedName)} disabled={!selectedName}><FiTrash2 /> Delete</button>
                <button style={palette.btn} title="Delete any line containing text"><FiScissors /> Delete line (use Chat)</button>
              </div>
            </div>

            <div>
              <div style={palette.label}>{diagramType === "sequence" ? "Message" : "Association"}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={relFrom} onChange={(e) => setRelFrom(e.target.value)} placeholder={diagramType === "sequence" ? "from participant" : "from"} style={{ ...palette.field, width: 160 }} />
                <input value={relTo} onChange={(e) => setRelTo(e.target.value)} placeholder={diagramType === "sequence" ? "to participant" : "to"} style={{ ...palette.field, width: 160 }} />
                <input value={relLabel} onChange={(e) => setRelLabel(e.target.value)} placeholder={diagramType === "sequence" ? "message label" : "label (optional)"} style={{ ...palette.field, width: 200 }} />
                {diagramType === "sequence"
                  ? <button style={palette.btn} onClick={() => addMessage(relFrom || selectedName, relTo, relLabel)}><FiGitCommit /> Add</button>
                  : <button style={palette.btn} onClick={() => addAssociation(relFrom || selectedName, relTo, relLabel)}><FiLink2 /> Add</button>}
              </div>
            </div>
          </div>

          {selectedType === "class" && (
            <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={palette.label}>Attributes (one per line, e.g. "+id: int")</div>
                <textarea value={attrText} onChange={(e) => setAttrText(e.target.value)} style={palette.textarea} />
              </div>
              <div>
                <div style={palette.label}>Methods (one per line, e.g. "+save(): void")</div>
                <textarea value={methodText} onChange={(e) => setMethodText(e.target.value)} style={palette.textarea} />
              </div>
              <div style={{ alignSelf: "flex-end" }}>
                <button style={palette.primary} onClick={() => onEditClass(selectedName, attrText.split(/\n+/).filter(Boolean), methodText.split(/\n+/).filter(Boolean))}><FiSave /> Apply to Class</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

/* ----------------------------------------
   HistoryDrawer (inline)
----------------------------------------- */
const HistoryDrawer = ({ onClose, diagrams, loadDiagram, snapshots, onRevert }) => {
  const styles = {
    wrap: { position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: "#ffffff", borderLeft: "1px solid #e5e7eb", boxShadow: "-8px 0 24px rgba(0,0,0,.06)", display: "flex", flexDirection: "column", zIndex: 40 },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: "1px solid #e5e7eb" },
    title: { margin: 0, fontWeight: 700, color: "#111827" },
    section: { padding: 16, borderBottom: "1px solid #f3f4f6" },
    list: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" },
    item: { padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" },
    btn: { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" },
  };
  return (
    <aside style={styles.wrap}>
      <div style={styles.header}>
        <h3 style={styles.title}>History & Diagrams</h3>
        <button onClick={onClose} style={styles.btn}><FiX /></button>
      </div>

      <div style={styles.section}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Saved on Server</div>
        <div style={styles.list}>
          {(diagrams || []).length === 0 && <div style={{ color: "#6b7280" }}>No saved diagrams</div>}
          {(diagrams || []).map((d) => (
            <div key={d.id} style={styles.item}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong>{d.name}</strong>
                <small style={{ color: "#6b7280" }}>{d.diagram_type} • {new Date(d.updated_at || d.created_at).toLocaleString()}</small>
              </div>
              <button onClick={() => loadDiagram(d.id)} style={styles.btn}>Load</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...styles.section, flex: 1 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Local Snapshots (Undo stack)</div>
        <div style={{ ...styles.list, maxHeight: "100%" }}>
          {(snapshots || []).length === 0 && <div style={{ color: "#6b7280" }}>No snapshots</div>}
          {(snapshots || []).map((s, idx) => (
            <div key={idx} style={styles.item}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong>{new Date(s.at).toLocaleTimeString()}</strong>
                <small style={{ color: "#6b7280" }}>{s.reason}</small>
              </div>
              <button onClick={() => onRevert(s)} style={styles.btn}><FiRotateCcw /> Revert</button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

/* ----------------------------------------
   App
----------------------------------------- */
export default function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [diagramType, setDiagramType] = useState("class");
  const [plantumlCode, setPlantumlCode] = useState("");

  const [diagrams, setDiagrams] = useState([]);
  const [currentDiagramId, setCurrentDiagramId] = useState(null);

  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [selectedName, setSelectedName] = useState("");
  const [selectedType, setSelectedType] = useState(null);

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lastSnapshotRef = useRef("");

  const backendUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

  // snapshotting
  useEffect(() => {
    if (!plantumlCode) return;
    const normalized = ensureWrapped(plantumlCode);
    if (normalized !== lastSnapshotRef.current) {
      if (lastSnapshotRef.current) {
        undoStack.current.push({ code: lastSnapshotRef.current, at: Date.now(), reason: "auto" });
        redoStack.current = [];
      }
      lastSnapshotRef.current = normalized;
    }
  }, [plantumlCode]);

  const fetchDiagrams = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/diagrams`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDiagrams(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessages((p) => [...p, { message: `❌ Couldn't load diagrams (${err.message}). Check server & CORS.`, sender: "UMLBot", direction: "incoming", type: "text" }]);
    }
  }, [backendUrl]);

  useEffect(() => { fetchDiagrams(); }, [fetchDiagrams]);

  const loadDiagram = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${backendUrl}/api/diagrams/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCurrentDiagramId(id);
      setDiagramType(data.diagram_type || "class");
      setPlantumlCode(ensureWrapped(data.plantuml_code || ""));
      undoStack.current = [];
      redoStack.current = [];
      lastSnapshotRef.current = ensureWrapped(data.plantuml_code || "");
      setMessages((prev) => [...prev, { message: `✅ Loaded diagram: ${data.name}`, sender: "UMLBot", direction: "incoming", type: "text" }]);
      setShowHistory(false);
    } catch (err) {
      setMessages((prev) => [...prev, { message: `❌ Failed to load diagram (${err.message})`, sender: "UMLBot", direction: "incoming", type: "text" }]);
    }
  }, [backendUrl]);

  const createDiagram = useCallback(async (code) => {
    const now = new Date();
    const name = `Diagram ${now.toLocaleString()}`;
    const res = await fetch(`${backendUrl}/api/diagrams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, diagram_type: diagramType, plantuml_code: ensureWrapped(code) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setCurrentDiagramId(data.id);
    fetchDiagrams();
    return data.id;
  }, [backendUrl, diagramType, fetchDiagrams]);

  const updateDiagram = useCallback(async (code) => {
    if (!currentDiagramId) return await createDiagram(code);
    const res = await fetch(`${backendUrl}/api/diagrams/${currentDiagramId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plantuml_code: ensureWrapped(code), diagram_type: diagramType }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    fetchDiagrams();
    return data.id || currentDiagramId;
  }, [backendUrl, currentDiagramId, diagramType, fetchDiagrams, createDiagram]);

  const handleSend = useCallback(async (input) => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { message: input, sender: "user", direction: "outgoing", type: "text" }]);
    setIsTyping(true);
    try {
      const res = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: input, type: diagramType, diagram_id: currentDiagramId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.plantuml) setPlantumlCode(ensureWrapped(data.plantuml));
      if (!currentDiagramId && data.diagram_id) setCurrentDiagramId(data.diagram_id);
      else if (!currentDiagramId && !data.diagram_id && data.plantuml) setCurrentDiagramId(await createDiagram(data.plantuml));
      setMessages((prev) => [...prev, { sender: "UMLBot", direction: "incoming", type: "text", message: data.explanation || "Diagram updated!" }]);
    } catch (err) {
      setMessages((prev) => [...prev, { message: `❌ Error: ${err.message}`, sender: "UMLBot", direction: "incoming", type: "text" }]);
    } finally { setIsTyping(false); }
  }, [backendUrl, diagramType, currentDiagramId, createDiagram]);

  // undo/redo
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const current = ensureWrapped(plantumlCode);
    const last = undoStack.current.pop();
    redoStack.current.push({ code: current, at: Date.now(), reason: "undo" });
    setPlantumlCode(last.code);
  }, [plantumlCode]);
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const current = ensureWrapped(plantumlCode);
    const next = redoStack.current.pop();
    undoStack.current.push({ code: current, at: Date.now(), reason: "redo" });
    setPlantumlCode(next.code);
  }, [plantumlCode]);

  // toolbar actions
  const setTypeAndReset = useCallback(async (nextType) => {
    setDiagramType(nextType);
    setPlantumlCode("");
    setCurrentDiagramId(null);
    setSelectedName("");
    setSelectedType(null);
    undoStack.current = [];
    redoStack.current = [];
    lastSnapshotRef.current = "";
    try { await fetch(`${backendUrl}/api/clear-session`, { method: "POST", credentials: "include" }); } catch {}
  }, [backendUrl]);

  const injectSnippet = useCallback((snippet) => {
    setPlantumlCode((prev) => appendSnippet(prev, snippet));
  }, []);
  const addClass = useCallback((name) => injectSnippet(addClassSnippet(name)), [injectSnippet]);
  const addActor = useCallback((name) => injectSnippet(addActorSnippet(name)), [injectSnippet]);
  const addUseCase = useCallback((label, alias) => injectSnippet(addUseCaseSnippet(label, alias)), [injectSnippet]);
  const addParticipant = useCallback((name) => injectSnippet(addParticipantSnippet(name)), [injectSnippet]);
  const addMessage = useCallback((from, to, text) => injectSnippet(addMessageSnippet(from, to, text)), [injectSnippet]);
  const addAssociation = useCallback((a, b, label) => injectSnippet(addAssociationSnippet(diagramType, a, b, label)), [injectSnippet, diagramType]);
  const onRename = useCallback((oldName, newName) => {
    if (!oldName || !newName) return;
    setPlantumlCode((prev) => renameAll(prev, oldName, newName));
    if (selectedName === oldName) setSelectedName(newName);
  }, [selectedName]);
  const onDelete = useCallback((name) => {
    if (!name) return;
    setPlantumlCode((prev) => deleteObjectFromCode(prev, name, diagramType));
    if (selectedName === name) { setSelectedName(""); setSelectedType(null); }
  }, [diagramType, selectedName]);
  const onEditClass = useCallback((className, attributesArr, methodsArr) => {
    setPlantumlCode((prev) => updateClassBlock(prev, className, attributesArr, methodsArr));
  }, []);
  const onSave = useCallback(async () => {
    const code = ensureWrapped(plantumlCode || "");
    try {
      const id = await updateDiagram(code);
      setCurrentDiagramId(id);
      setMessages((prev) => [...prev, { message: "✅ Saved to server", sender: "UMLBot", direction: "incoming", type: "text" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { message: `❌ Save failed: ${e.message}`, sender: "UMLBot", direction: "incoming", type: "text" }]);
    }
  }, [plantumlCode, updateDiagram]);

  const entities = useMemo(() => extractEntities(plantumlCode, diagramType), [plantumlCode, diagramType]);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif" }}>
      {/* LEFT: Diagram & Pro Toolbar */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb" }}>
        <ProToolbar
          diagramType={diagramType}
          setDiagramType={setTypeAndReset}
          onSave={onSave}
          onUndo={undo}
          onRedo={redo}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
          onOpenHistory={() => setShowHistory(true)}
          selectedName={selectedName}
          selectedType={selectedType}
          setSelectedName={setSelectedName}
          setSelectedType={setSelectedType}
          entities={entities}
          addClass={addClass}
          addActor={addActor}
          addUseCase={addUseCase}
          addParticipant={addParticipant}
          addMessage={addMessage}
          addAssociation={addAssociation}
          onRename={onRename}
          onDelete={onDelete}
          onEditClass={onEditClass}
          onExport={() => setShowExport(true)}
        />
        <div style={{ flex: 1, overflow: "auto", background: "#fafafa" }}>
          <PlantUMLViewer code={plantumlCode} />
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
          plantumlCode={ensureWrapped(plantumlCode)}
          diagramSelector='img[data-diagram="uml"]'
          chatMessages={messages}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* History Drawer */}
      {showHistory && (
        <HistoryDrawer
          onClose={() => setShowHistory(false)}
          diagrams={diagrams}
          loadDiagram={loadDiagram}
          snapshots={undoStack.current}
          onRevert={(snapshot) => { if (!snapshot) return; setPlantumlCode(snapshot.code); setShowHistory(false); }}
        />
      )}
    </div>
  );
}
