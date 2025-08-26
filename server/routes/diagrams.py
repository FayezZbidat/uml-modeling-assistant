import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from db import db
from models import Diagram

diagrams_bp = Blueprint('diagrams', __name__)

# Create new diagram
@diagrams_bp.route('/diagrams', methods=['POST'])
def create_diagram():
    data = request.get_json()
    diagram_type = data.get('diagram_type')
    plantuml_code = data.get('plantuml_code')
    flow_data = data.get('flow_data')
    name = data.get('name') or datetime.now().strftime("Diagram %Y-%m-%d %H:%M:%S")

    if not all([diagram_type, plantuml_code]):
        return jsonify({"error": "Missing required fields"}), 400

    diagram = Diagram(
        id=str(uuid.uuid4()),
        name=name,
        diagram_type=diagram_type,
        plantuml_code=plantuml_code,
        flow_data=json.dumps(flow_data) if flow_data else None
    )
    db.session.add(diagram)
    db.session.commit()

    return jsonify(diagram.to_dict()), 201

# Get diagram
@diagrams_bp.route('/diagrams/<string:diagram_id>', methods=['GET'])
def get_diagram(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if not diagram:
        return jsonify({"error": "Diagram not found"}), 404
    return jsonify(diagram.to_dict()), 200

# Update diagram
@diagrams_bp.route('/diagrams/<string:diagram_id>', methods=['PUT'])
def update_diagram(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if not diagram:
        return jsonify({"error": "Diagram not found"}), 404

    data = request.get_json()
    diagram.name = data.get('name', diagram.name)
    diagram.diagram_type = data.get('diagram_type', diagram.diagram_type)
    diagram.plantuml_code = data.get('plantuml_code', diagram.plantuml_code)
    if "flow_data" in data:
        diagram.flow_data = json.dumps(data["flow_data"]) if data["flow_data"] else None

    db.session.commit()
    return jsonify(diagram.to_dict()), 200

# Delete diagram
@diagrams_bp.route('/diagrams/<string:diagram_id>', methods=['DELETE'])
def delete_diagram(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if not diagram:
        return jsonify({"error": "Diagram not found"}), 404

    db.session.delete(diagram)
    db.session.commit()
    return jsonify({"message": "Diagram deleted"}), 200

# List all diagrams (newest first)
@diagrams_bp.route('/diagrams', methods=['GET'])
def list_diagrams():
    diagrams = Diagram.query.order_by(Diagram.created_at.desc()).all()
    return jsonify([d.to_dict() for d in diagrams]), 200

# Save ReactFlow model
@diagrams_bp.route('/diagrams/<string:diagram_id>/save-model', methods=['POST'])
def save_model(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if not diagram:
        return jsonify({"error": "Diagram not found"}), 404

    data = request.get_json()
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    def flow_to_plantuml(nodes, edges):
        plantuml = "@startuml\n"
        for node in nodes:
            label = node.get("data", {}).get("label", node["id"])
            plantuml += f"class {label} {{\n"
            for attr in node.get("data", {}).get("attributes", []):
                plantuml += f"  +{attr}\n"
            plantuml += "}\n\n"
        for edge in edges:
            label = edge.get("data", {}).get("label", "")
            plantuml += f"{edge['source']} --> {edge['target']}"
            if label:
                plantuml += f" : {label}"
            plantuml += "\n"
        plantuml += "@enduml"
        return plantuml

    plantuml_code = flow_to_plantuml(nodes, edges)

    diagram.plantuml_code = plantuml_code
    diagram.flow_data = json.dumps({"nodes": nodes, "edges": edges})
    db.session.commit()

    return jsonify({
        "message": "Model saved successfully",
        "diagram": diagram.to_dict()
    }), 200
