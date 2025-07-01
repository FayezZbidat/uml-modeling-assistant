import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from db import db
from models import Diagram

diagrams_bp = Blueprint('diagrams', __name__)

# Create a new diagram with timestamped name if name not provided
@diagrams_bp.route('/diagrams', methods=['POST'])
def create_diagram():
    data = request.get_json()
    diagram_type = data.get('diagram_type')
    plantuml_code = data.get('plantuml_code')

    # Generate a name if not provided
    name = data.get('name')
    if not name:
        name = datetime.now().strftime("Diagram %Y-%m-%d %H:%M:%S")

    if not all([diagram_type, plantuml_code]):
        return jsonify({"error": "Missing required fields"}), 400

    diagram = Diagram(
        id=str(uuid.uuid4()),
        name=name,
        diagram_type=diagram_type,
        plantuml_code=plantuml_code
    )
    db.session.add(diagram)
    db.session.commit()

    return jsonify(diagram.to_dict()), 201

# Get diagram by id
@diagrams_bp.route('/diagrams/<string:diagram_id>', methods=['GET'])
def get_diagram(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if diagram is None:
        return jsonify({"error": "Diagram not found"}), 404
    return jsonify(diagram.to_dict()), 200

# Update diagram
@diagrams_bp.route('/diagrams/<string:diagram_id>', methods=['PUT'])
def update_diagram(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if diagram is None:
        return jsonify({"error": "Diagram not found"}), 404

    data = request.get_json()
    diagram.name = data.get('name', diagram.name)
    diagram.diagram_type = data.get('diagram_type', diagram.diagram_type)
    diagram.plantuml_code = data.get('plantuml_code', diagram.plantuml_code)

    db.session.commit()
    return jsonify(diagram.to_dict()), 200

# Delete diagram
@diagrams_bp.route('/diagrams/<string:diagram_id>', methods=['DELETE'])
def delete_diagram(diagram_id):
    diagram = Diagram.query.get(diagram_id)
    if diagram is None:
        return jsonify({"error": "Diagram not found"}), 404

    db.session.delete(diagram)
    db.session.commit()
    return jsonify({"message": "Diagram deleted"}), 200

# List all diagrams
@diagrams_bp.route('/diagrams', methods=['GET'])
def list_diagrams():
    diagrams = Diagram.query.order_by(Diagram.created_at.desc()).all()
    return jsonify([d.to_dict() for d in diagrams]), 200
