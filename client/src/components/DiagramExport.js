import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const DiagramExport = ({ plantumlCode, diagramUrl, encodedCode }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('png');
  const [exportStatus, setExportStatus] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    quality: 'high',
    background: '#ffffff',
    includeCode: false,
    fileName: 'uml-diagram'
  });

  // Helper function to generate filename
  const getFileName = (extension) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${exportSettings.fileName}-${timestamp}.${extension}`;
  };

  // Helper function to show status messages
  const showStatus = (message, isError = false) => {
    setExportStatus(message);
    setTimeout(() => setExportStatus(''), 3000);
    if (isError) console.error(message);
  };

  // Export as PNG with quality options
  const exportAsPNG = async () => {
    try {
      setIsExporting(true);
      showStatus('Generating PNG...');
      
      // Determine quality settings
      const scale = exportSettings.quality === 'high' ? 3 : exportSettings.quality === 'medium' ? 2 : 1;
      
      // Try direct PlantUML server download first
      try {
        const url = `https://www.plantuml.com/plantuml/png/${encodedCode}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const blob = await response.blob();
          saveAs(blob, getFileName('png'));
          showStatus('PNG exported successfully!');
          return;
        }
      } catch (serverError) {
        console.warn('PlantUML server method failed, trying canvas method...');
      }
      
      // Fallback: Create a temporary container with the SVG
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.backgroundColor = exportSettings.background;
      document.body.appendChild(tempContainer);
      
      // Load SVG into container
      const img = document.createElement('img');
      img.src = `https://www.plantuml.com/plantuml/svg/${encodedCode}`;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        tempContainer.appendChild(img);
      });
      
      // Convert to canvas
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: exportSettings.background,
        scale: scale,
        logging: false,
        useCORS: true
      });
      
      // Clean up
      document.body.removeChild(tempContainer);
      
      // Convert to blob and save
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

  // Export as SVG with optimization
  const exportAsSVG = async () => {
    try {
      setIsExporting(true);
      showStatus('Generating SVG...');
      
      const url = `https://www.plantuml.com/plantuml/svg/${encodedCode}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to fetch SVG');
      
      let svgText = await response.text();
      
      // Clean and optimize SVG
      svgText = svgText.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
      
      // Add background if specified
      if (exportSettings.background !== 'transparent') {
        const bgRect = `<rect width="100%" height="100%" fill="${exportSettings.background}"/>`;
        svgText = svgText.replace(/(<svg[^>]*>)/, `$1${bgRect}`);
      }
      
      // Create blob and download
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, getFileName('svg'));
      showStatus('SVG exported successfully!');
      
    } catch (error) {
      showStatus('Failed to export SVG: ' + error.message, true);
    } finally {
      setIsExporting(false);
    }
  };

  // Export as PDF with advanced options
  const exportAsPDF = async () => {
    try {
      setIsExporting(true);
      showStatus('Generating PDF...');
      
      // Determine PDF orientation based on diagram
      const isLandscape = plantumlCode.includes('left to right') || 
                         plantumlCode.includes('top to bottom');
      
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: exportSettings.quality === 'high' ? 'a3' : 'a4'
      });
      
      // Add metadata
      pdf.setProperties({
        title: exportSettings.fileName,
        subject: 'UML Diagram Export',
        author: 'UML Modeling Assistant',
        keywords: 'uml, diagram, ' + exportFormat,
        creator: 'UML Modeling Assistant'
      });
      
      // Add header
      pdf.setFontSize(18);
      pdf.setTextColor(33, 33, 33);
      pdf.text(exportSettings.fileName, 20, 20);
      
      // Add timestamp
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 28);
      
      // Get image data
      const pngUrl = `https://www.plantuml.com/plantuml/png/${encodedCode}`;
      const response = await fetch(pngUrl);
      const blob = await response.blob();
      
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = function() {
        const base64data = reader.result;
        
        // Calculate image dimensions
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = pageHeight - 60; // Leave space for header
        
        // Add image
        let imgWidth = maxWidth;
        let imgHeight = maxHeight;
        
        // Maintain aspect ratio
        const img = new Image();
        img.onload = function() {
          const aspectRatio = img.width / img.height;
          if (imgWidth / imgHeight > aspectRatio) {
            imgWidth = imgHeight * aspectRatio;
          } else {
            imgHeight = imgWidth / aspectRatio;
          }
          
          const x = (pageWidth - imgWidth) / 2;
          const y = 40;
          
          pdf.addImage(base64data, 'PNG', x, y, imgWidth, imgHeight);
          
          // Add PlantUML code if requested
          if (exportSettings.includeCode && plantumlCode) {
            pdf.addPage();
            pdf.setFontSize(14);
            pdf.setTextColor(33, 33, 33);
            pdf.text('PlantUML Source Code', 20, 20);
            
            pdf.setFontSize(9);
            pdf.setFont('courier');
            
            // Split code into lines
            const lines = plantumlCode.split('\n');
            let yPosition = 35;
            const lineHeight = 4;
            const pageBottom = pageHeight - 20;
            
            lines.forEach(line => {
              if (yPosition > pageBottom) {
                pdf.addPage();
                yPosition = 20;
              }
              
              // Handle long lines by wrapping
              const maxLineWidth = pageWidth - 40;
              const wrappedLines = pdf.splitTextToSize(line, maxLineWidth);
              
              wrappedLines.forEach(wrappedLine => {
                pdf.text(wrappedLine, 20, yPosition);
                yPosition += lineHeight;
              });
            });
          }
          
          // Save PDF
          pdf.save(getFileName('pdf'));
          showStatus('PDF exported successfully!');
        };
        img.src = base64data;
      };
      reader.readAsDataURL(blob);
      
    } catch (error) {
      showStatus('Failed to export PDF: ' + error.message, true);
    } finally {
      setIsExporting(false);
    }
  };

  // Copy PlantUML code to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(plantumlCode);
      showStatus('Code copied to clipboard!');
    } catch (error) {
      showStatus('Failed to copy code', true);
    }
  };

  // Main export handler
  const handleExport = () => {
    switch (exportFormat) {
      case 'png':
        exportAsPNG();
        break;
      case 'svg':
        exportAsSVG();
        break;
      case 'pdf':
        exportAsPDF();
        break;
      default:
        exportAsPNG();
    }
  };

  return (
    <div style={styles.container}>
      {/* Main export controls */}
      <div style={styles.exportControls}>
        <select 
          value={exportFormat} 
          onChange={(e) => setExportFormat(e.target.value)}
          style={styles.select}
          disabled={isExporting}
        >
          <option value="png">PNG Image</option>
          <option value="svg">SVG Vector</option>
          <option value="pdf">PDF Document</option>
        </select>
        
        <button 
          onClick={handleExport}
          disabled={isExporting}
          style={{
            ...styles.exportButton,
            opacity: isExporting ? 0.6 : 1,
            cursor: isExporting ? 'not-allowed' : 'pointer'
          }}
        >
          {isExporting ? '⏳ Exporting...' : `📥 Export as ${exportFormat.toUpperCase()}`}
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
          
          <div style={styles.settingRow}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={exportSettings.includeCode}
                onChange={(e) => setExportSettings({...exportSettings, includeCode: e.target.checked})}
              />
              Include source code in PDF
            </label>
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
          📋 Copy Code
        </button>
        <button 
          onClick={() => window.open(`https://www.plantuml.com/plantuml/svg/${encodedCode}`, '_blank')}
          style={styles.quickButton}
          title="Open in new tab"
        >
          🔗 Open
        </button>
      </div>
      
      {/* Status message */}
      {exportStatus && (
        <div style={{
          ...styles.status,
          color: exportStatus.includes('Failed') ? '#dc3545' : '#28a745'
        }}>
          {exportStatus}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    marginTop: '15px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    border: '1px solid #dee2e6',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  exportControls: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  select: {
    padding: '10px 15px',
    borderRadius: '6px',
    border: '1px solid #ced4da',
    fontSize: '14px',
    backgroundColor: 'white',
    minWidth: '150px'
  },
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s',
    boxShadow: '0 2px 4px rgba(0,123,255,0.3)'
  },
  settingsButton: {
    padding: '10px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  advancedSettings: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#e9ecef',
    borderRadius: '6px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px'
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    minWidth: '80px'
  },
  smallSelect: {
    padding: '5px 10px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '13px',
    flex: 1
  },
  colorInput: {
    width: '50px',
    height: '30px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    cursor: 'pointer'
  },
  textInput: {
    padding: '5px 10px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '13px',
    flex: 1
  },
  checkboxLabel: {
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer'
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: '1px solid #dee2e6'
  },
  quickButton: {
    padding: '8px 15px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  status: {
    marginTop: '10px',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)'
  }
};

export default DiagramExport;