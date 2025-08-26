import React from "react";
import plantumlEncoder from "plantuml-encoder";

const PlantUMLViewer = ({ code }) => {
  if (!code) return <div style={{ textAlign: "center", padding: "20px" }}>No diagram yet</div>;

  const encoded = plantumlEncoder.encode(code);
  const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;

  return (
    <div style={{ textAlign: "center", height: "100%", overflow: "auto" }}>
      <img src={url} alt="UML Diagram" style={{ maxWidth: "100%" }} />
    </div>
  );
};

export default PlantUMLViewer;
