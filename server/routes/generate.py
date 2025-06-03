from flask import Blueprint, request, jsonify 
from services.parser import parse_text_to_model
from utils.plantuml import generate_plantuml

generate_bp = Blueprint('generate', __name__)

@generate_bp.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    text = data.get("text", "")
    
    model = parse_text_to_model(text)
    plantuml_code = generate_plantuml(model)

    return jsonify({
        "plantuml": plantuml_code,
        "model": model
    })

@generate_bp.route('/save-model', methods=['POST'])
def save_model():
    data = request.get_json()
    print("🔄 Received updated UML model:", data)
    # TODO: Save to file or database if needed
    return jsonify({"status": "success"})
