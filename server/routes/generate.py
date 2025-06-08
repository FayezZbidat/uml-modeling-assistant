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
    explanation = generate_explanation(model)  

    return jsonify({
        "plantuml": plantuml_code,
        "model": model,
        "explanation": explanation 
    })


@generate_bp.route('/save-model', methods=['POST'])
def save_model():
    data = request.get_json()
    print("🔄 Received updated UML model:", data)
    return jsonify({"status": "success"})


def generate_explanation(model):
    if not model or not model.get("classes"):
        return "<p>No classes were identified in the model.</p>"

    explanation = ["<h3>📘 Diagram Overview</h3>"]

    # Classes
    explanation.append("<h4>🧩 Classes:</h4><ul>")
    for cls in model["classes"]:
        attrs = ", ".join(cls["attributes"]) if cls["attributes"] else "<i>no attributes</i>"
        explanation.append(f"<li><strong>{cls['name']}</strong> – has the attributes: {attrs}</li>")
    explanation.append("</ul>")

    # Relationships
    if model.get("relationships"):
        explanation.append("<h4>🔗 Relationships:</h4><ul>")
        for rel in model["relationships"]:
            from_cls = rel["from"]
            to_cls = rel["to"]
            rel_type = rel.get("type", "unspecified relationship")
            label = rel.get("label", "relation")
            explanation.append(
                f"<li><strong>{from_cls}</strong> <em>{label}</em> <strong>{to_cls}</strong> "
                f"(<code>{rel_type}</code>)</li>"
            )
        explanation.append("</ul>")

    return "\n".join(explanation)

