from flask import Blueprint, request, jsonify
from services.parser import parse_text_to_model
from utils.plantuml import generate_plantuml

generate_bp = Blueprint('generate', __name__)

@generate_bp.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    text = data.get("text", "")
    
    # Get the structured model
    model = parse_text_to_model(text)
    
    # Generate PlantUML from model
    plantuml_code = generate_plantuml(model)
    
    # Return BOTH model and PlantUML code
    return jsonify({
        "plantuml": plantuml_code,
        "model": model
    })
