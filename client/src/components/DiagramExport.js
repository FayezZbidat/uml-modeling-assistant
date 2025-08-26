import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { FiDownload, FiCopy, FiExternalLink, FiX, FiFileText } from 'react-icons/fi';
import plantumlEncoder from 'plantuml-encoder';

const DiagramExport = ({ plantumlCode, diagramRef, chatMessages, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('png');
  const [exportStatus, setExportStatus] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    quality: 'high',
    background: '#ffffff',
    includeChatLog: false,
    fileName: 'uml-diagram'
  });

  const getFileName = (extension) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${exportSettings.fileName}-${timestamp}.${extension}`;
  };

  const showStatus = (message, isError = false) => {
    setExportStatus(message);
    setTimeout(() => setExportStatus(''), 3000);
    if (isError) console.error(message);
  };

  // Export as PNG
  const exportAsPNG = async () => {
    try {
      if (!diagramRef || !diagramRef.current) {
        showStatus('No diagram element found to capture', true);
        return;
      }
      setIsExporting(true);
      showStatus('Generating PNG...');
      
      const scale = exportSettings.quality === 'high' ? 3 : 
                   exportSettings.quality === 'medium' ? 2 : 1;
      
      const canvas = await html2canvas(diagramRef.current, {
        backgroundColor: exportSettings.background,
        scale: scale,
        logging: false,
        useCORS: true
      });
      
      canvas.toBlob((blob) => {
        saveAs(blob, getFileName('png'));
        showStatus('PNG exported successfully!');
      }, 'image/png', exportSettings.quality === 'high' ? 1.0 : 0.9);
      
    } catch (error) {
      showStatus('Failed to export PNG: ' + error.message, true);
    } finally {
      setIsExporting(false);
    }
  };

  // Export as PDF (diagram + PlantUML only)
  const exportAsPDF = async () => {
    try {
      if (!diagramRef || !diagramRef.current) {
        showStatus('No diagram element found to capture', true);
        return;
      }
      setIsExporting(true);
      showStatus('Generating PDF...');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      pdf.setProperties({
        title: exportSettings.fileName,
        subject: 'UML Diagram Export',
        author: 'UML Modeling Assistant',
        creator: 'UML Modeling Assistant'
      });

      const canvas = await html2canvas(diagramRef.current, {
        backgroundColor: exportSettings.background,
        scale: 2,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);

      // PlantUML code page
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.setTextColor(33, 33, 33);
      pdf.text('PlantUML Source Code', 20, 20);

      pdf.setFontSize(9);
      pdf.setFont('courier', 'normal');
      pdf.setTextColor(0, 0, 0);

      let codeY = 35;
      plantumlCode.split('\n').forEach(line => {
        if (codeY > pageHeight - 20) {
          pdf.addPage();
          codeY = 20;
        }
        const wrappedLines = pdf.splitTextToSize(line, pageWidth - 40);
        wrappedLines.forEach(wrappedLine => {
          pdf.text(wrappedLine, 20, codeY);
          codeY += 5;
        });
      });

      pdf.save(getFileName('pdf'));
      showStatus('PDF exported successfully!');
    } catch (error) {
      showStatus('Failed to export PDF: ' + error.message, true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    switch (exportFormat) {
      case 'png':
        exportAsPNG();
        break;
      case 'pdf':
        exportAsPDF();
        break;
      default:
        exportAsPNG();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(plantumlCode || "");
      showStatus('PlantUML code copied to clipboard!');
    } catch (error) {
      showStatus('Failed to copy code', true);
    }
  };

  // ✅ Proper PlantUML link using deflated encoding
  const openInNewTab = () => {
    try {
      const encoded = plantumlEncoder.encode(plantumlCode || "@startuml\n@enduml");
      window.open(`https://www.plantuml.com/plantuml/svg/${encoded}`, "_blank");
    } catch (e) {
      showStatus("Failed to open PlantUML online", true);
    }
  };

  const styles = {
    container: {
      padding: '20px',
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      margin: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '16px',
      borderBottom: '2px solid #f1f5f9'
    },
    title: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#1f2937',
      margin: 0
    },
    closeButton: {
      padding: '8px',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#6b7280',
      cursor: 'pointer',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease'
    },
    exportControls: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: '16px'
    },
    select: {
      padding: '10px 12px',
      borderRadius: '8px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      backgroundColor: 'white',
      color: '#374151',
      fontWeight: '500',
      cursor: 'pointer',
      minWidth: '120px'
    },
    exportButton: {
      padding: '10px 20px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
    },
    settingsButton: {
      padding: '10px',
      border: '1px solid #d1d5db',
      backgroundColor: 'white',
      color: '#6b7280',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center'
    },
    advancedSettings: {
      padding: '20px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      marginBottom: '16px'
    },
    settingRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '12px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      minWidth: '100px'
    },
    smallSelect: {
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      backgroundColor: 'white',
      color: '#374151',
      cursor: 'pointer',
      minWidth: '100px'
    },
    colorInput: {
      width: '40px',
      height: '40px',
      borderRadius: '6px',
      border: '1px solid #d1d5db',
      cursor: 'pointer',
      padding: 0
    },
    textInput: {
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      backgroundColor: 'white',
      color: '#374151',
      minWidth: '200px'
    },
    quickActions: {
      display: 'flex',
      gap: '8px',
      paddingTop: '16px',
      borderTop: '1px solid #e2e8f0'
    },
    quickButton: {
      padding: '8px 16px',
      border: '1px solid #d1d5db',
      backgroundColor: 'white',
      color: '#374151',
      borderRadius: '6px',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    status: {
      marginTop: '12px',
      padding: '12px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      textAlign: 'center',
      backgroundColor: '#f0f9ff',
      color: '#0369a1',
      border: '1px solid #bae6fd'
    },
    errorStatus: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca'
    }
  };

  const mergeStyles = (baseStyle, hoverStyle, condition) =>
    condition ? { ...baseStyle, ...hoverStyle } : baseStyle;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Export Diagram</h3>
        <button 
          onClick={onClose}
          style={styles.closeButton}
          title="Close export panel"
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Main export controls */}
      <div style={styles.exportControls}>
        <select 
          value={exportFormat} 
          onChange={(e) => setExportFormat(e.target.value)}
          style={styles.select}
          disabled={isExporting}
        >
          <option value="png">PNG Image</option>
          <option value="pdf">PDF Document</option>
        </select>
        
        <button 
          onClick={handleExport}
          disabled={isExporting}
          style={mergeStyles(
            styles.exportButton,
            { backgroundColor: '#2563eb', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' },
            !isExporting
          )}
        >
          <FiDownload size={16} />
          {isExporting ? 'Exporting...' : 'Export Diagram'}
        </button>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={styles.settingsButton}
          title="Advanced settings"
        >
          ⚙️
        </button>
      </div>
      
      {/* Advanced settings */}
      {showAdvanced && (
        <div style={styles.advancedSettings}>
          <div style={styles.settingRow}>
            <label style={styles.label}>Quality:</label>
            <select
              value={exportSettings.quality}
              onChange={(e) => setExportSettings({...exportSettings, quality: e.target.value})}
              style={styles.smallSelect}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div style={styles.settingRow}>
            <label style={styles.label}>Background:</label>
            <input
              type="color"
              value={exportSettings.background}
              onChange={(e) => setExportSettings({...exportSettings, background: e.target.value})}
              style={styles.colorInput}
            />
          </div>
          
          <div style={styles.settingRow}>
            <label style={styles.label}>File name:</label>
            <input
              type="text"
              value={exportSettings.fileName}
              onChange={(e) => setExportSettings({...exportSettings, fileName: e.target.value})}
              style={styles.textInput}
            />
          </div>
        </div>
      )}
      
      {/* Quick actions */}
      <div style={styles.quickActions}>
        <button 
          onClick={copyToClipboard}
          style={styles.quickButton}
          title="Copy PlantUML code"
        >
          <FiCopy size={14} />
          Copy Code
        </button>
        
        <button 
          onClick={openInNewTab}
          style={styles.quickButton}
          title="Open in PlantUML editor"
        >
          <FiExternalLink size={14} />
          Open Online
        </button>
        
        <button 
          onClick={() => {
            try {
              if (!chatMessages || chatMessages.length === 0) {
                showStatus('No chat messages to export', true);
                return;
              }
              let chatText = `UML Modeling Assistant - Chat Log\n`;
              chatText += `Generated: ${new Date().toLocaleString()}\n`;
              chatText += `========================================\n\n`;
              chatMessages.forEach(msg => {
                const timestamp = new Date(msg.timestamp || Date.now()).toLocaleTimeString();
                const sender = msg.sender === 'user' ? 'You' : 'UMLBot';
                chatText += `[${timestamp}] ${sender}: ${msg.message}\n`;
              });
              const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
              saveAs(blob, getFileName('txt'));
              showStatus('Chat log exported successfully!');
            } catch (error) {
              showStatus('Failed to export chat log: ' + error.message, true);
            }
          }}
          style={styles.quickButton}
          title="Export chat log as text file"
        >
          <FiFileText size={14} />
          Export Chat
        </button>
      </div>
      
      {/* Status message */}
      {exportStatus && (
        <div style={{
          ...styles.status,
          ...(exportStatus.includes('Failed') ? styles.errorStatus : {})
        }}>
          {exportStatus.includes('Failed') ? '❌ ' : '✅ '}
          {exportStatus}
        </div>
      )}
    </div>
  );
};

export default DiagramExport;
