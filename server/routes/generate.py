from flask import Blueprint, request, jsonify, make_response
from openai import OpenAI
import uuid
import os
import re
import json
from services.parser import parse_text_to_model
from utils.plantuml import generate_plantuml
from models import Diagram, ConversationSession
from db import db
from dotenv import load_dotenv

load_dotenv()

generate_bp = Blueprint('generate', __name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ----------------------------
# Helpers
# ----------------------------

def get_session_id(req):
    sid = req.cookies.get("session_id")
    if not sid:
        sid = str(uuid.uuid4())
    return sid

def _system_for_type(diagram_type: str, existing_content: str | None) -> str:
    if diagram_type == "usecase":
        base = (
            "You are an assistant that generates UML **Use Case** diagrams only. "
            "Never output Class or Sequence diagrams.\n"
            "Output either PlantUML for use case diagrams (actors/usecase/associations) or JSON of the use case model."
        )
    elif diagram_type == "sequence":
        base = (
            "You are an assistant that generates UML **Sequence** diagrams only. "
            "Never output Class or Use Case diagrams.\n"
            "Output either PlantUML for sequence diagrams (participants/actor/messages) or JSON of the sequence model."
        )
    else:
        base = (
            "You are an assistant that generates UML **Class** diagrams only. "
            "Never output Use Case or Sequence diagrams.\n"
            "Output either PlantUML for class diagrams (class/relationships) or JSON of the class model."
        )

    if existing_content:
        base += (
            f"\n\nEDIT MODE: You are editing an existing {diagram_type} diagram. "
            f"Modify the current diagram content rather than creating a new one.\n"
            f"CURRENT DIAGRAM CONTENT:\n{existing_content}"
        )
    return base

def extract_plantuml_blocks(text: str) -> str:
    """Extract valid PlantUML (@startuml ... @enduml)."""
    match = re.findall(r'@startuml[\s\S]*?@enduml', text)
    if match:
        return "\n".join(match)
    return ""

def extract_json_block(text: str):
    """Extract JSON object from GPT output (fenced, inline, etc.)."""
    # ```json ... ```
    match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if match:
        candidate = match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except:
            pass
    # ``` ... ```
    match = re.search(r'```\s*([\s\S]*?)\s*```', text)
    if match:
        candidate = match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except:
            pass
    # Largest {...}
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        candidate = match.group(1).strip()
        candidate = re.sub(r',\s*([\]}])', r'\1', candidate)  # fix trailing commas
        try:
            json.loads(candidate)
            return candidate
        except:
            pass
    return None

# ----------------------------
# Route
# ----------------------------

@generate_bp.route('/generate', methods=['POST'])
def generate():
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    diagram_type = (data.get("type", "class") or "class").strip().lower()
    diagram_id = data.get("diagram_id")

    print("📥 Received text:", text)
    print("📘 Diagram type:", diagram_type)
    print("📊 Diagram ID:", diagram_id)

    session_id = get_session_id(request)

    # Load/create conversation container
    session = ConversationSession.query.get(session_id)
    if session:
        conversation = json.loads(session.messages or "[]")
    else:
        conversation = []
        session = ConversationSession(
            id=session_id,
            diagram_id=diagram_id,
            messages=json.dumps(conversation)
        )
        db.session.add(session)

    # If a diagram_id arrives, load its current content for EDIT MODE context
    existing_content = None
    if diagram_id:
        diagram = Diagram.query.get(diagram_id)
        if diagram:
            existing_content = diagram.plantuml_code

    # 🔧 CRITICAL FIX:
    # Always replace ANY existing system messages with the correct, fresh one for THIS request type.
    conversation = [m for m in conversation if m.get("role") != "system"]
    conversation.insert(0, {"role": "system", "content": _system_for_type(diagram_type, existing_content)})

    # Append user message
    conversation.append({"role": "user", "content": text})

    # Quick validation
    if len(text.split()) < 3:
        resp = make_response(jsonify({
            "plantuml": "",
            "model": {},
            "explanation": "❗ Please describe a system.",
            "diagram_id": diagram_id
        }), 200)
        resp.set_cookie("session_id", session_id, httponly=True, samesite='Lax')
        return resp

    try:
        # Call GPT
        response = client.chat.completions.create(
            model="gpt-4",
            messages=conversation,
            temperature=0.2
        )
        reply = response.choices[0].message.content
        print("🤖 GPT reply:", reply)

        plantuml_code = extract_plantuml_blocks(reply)
        json_block = extract_json_block(reply)

        # 🛡️ Type-guard. If PlantUML of wrong type, discard so we fallback to JSON or parser.
        if plantuml_code:
            if diagram_type == "sequence" and ("participant" not in plantuml_code and "actor" not in plantuml_code):
                print("⚠️ Discarding wrong diagram type (not sequence)")
                plantuml_code = ""
            elif diagram_type == "usecase" and ("usecase" not in plantuml_code and "actor" not in plantuml_code):
                print("⚠️ Discarding wrong diagram type (not use case)")
                plantuml_code = ""
            elif diagram_type == "class" and "class" not in plantuml_code:
                print("⚠️ Discarding wrong diagram type (not class)")
                plantuml_code = ""

        explanation = reply.strip()
        model = None

        # 1) If we have valid PlantUML of the right type, we're done (optional: also produce model)
        if plantuml_code:
            model = parse_text_to_model(text, diagram_type)

        # 2) If we got JSON, convert to PlantUML (forced to the requested type)
        if not plantuml_code and json_block:
            print("✅ Extracted JSON block:\n", json_block)
            try:
                model = json.loads(json_block)
                plantuml_code = generate_plantuml(model, diagram_type)
                explanation += "\n\n✅ Generated PlantUML from JSON model."
            except Exception as e:
                print("❌ JSON parse error:", e)

        # 3) If still nothing, parse text → model → PlantUML
        if not plantuml_code:
            model = parse_text_to_model(text, diagram_type, existing_model=model)
            if model:
                plantuml_code = generate_plantuml(model, diagram_type)
                explanation += "\n\n✅ Generated PlantUML from parsed text model."

        # 4) Final fallback specific to requested type
        if not plantuml_code:
            explanation += "\n\n⚠️ No UML code detected. Showing fallback example."
            if diagram_type == "usecase":
                plantuml_code = """@startuml
actor User
usecase "Login" as UC1
User --> UC1
@enduml"""
            elif diagram_type == "sequence":
                plantuml_code = """@startuml
participant User
participant System
User -> System: Login request
System --> User: Success
@enduml"""
            else:
                plantuml_code = """@startuml
class User {
  +id
  +name
  +email
}
@enduml"""

        # Persist conversation and diagram
        conversation.append({"role": "assistant", "content": reply})
        session.messages = json.dumps(conversation)
        session.diagram_id = diagram_id  # keep it in sync

        # Create/update diagram
        if diagram_id:
            diagram = Diagram.query.get(diagram_id)
            if diagram:
                diagram.plantuml_code = plantuml_code.strip()
                diagram.diagram_type = diagram_type
            else:
                # diagram_id provided but missing -> create new
                new_diagram = Diagram(
                    id=str(uuid.uuid4()),
                    name="Generated Diagram",
                    diagram_type=diagram_type,
                    plantuml_code=plantuml_code.strip()
                )
                db.session.add(new_diagram)
                db.session.flush()
                diagram_id = new_diagram.id
                session.diagram_id = diagram_id
        else:
            new_diagram = Diagram(
                id=str(uuid.uuid4()),
                name="Generated Diagram",
                diagram_type=diagram_type,
                plantuml_code=plantuml_code.strip()
            )
            db.session.add(new_diagram)
            db.session.flush()  # get id
            diagram_id = new_diagram.id
            session.diagram_id = diagram_id

        db.session.commit()

        resp = make_response(jsonify({
            "plantuml": plantuml_code.strip(),
            "model": model or {},
            "explanation": explanation.strip(),
            "diagram_id": diagram_id
        }), 200)
        resp.set_cookie("session_id", session_id, httponly=True, samesite='Lax')
        return resp

    except Exception as e:
        print(f"🔥 Server error: {str(e)}")
        return make_response(jsonify({
            "plantuml": "",
            "model": {},
            "explanation": f"❌ Error: {str(e)}",
            "diagram_id": diagram_id
        }), 500)


@generate_bp.route('/clear-session', methods=['POST'])
def clear_session():
    session_id = get_session_id(request)
    session = ConversationSession.query.get(session_id)
    if session:
        db.session.delete(session)
        db.session.commit()
    
    resp = jsonify({"message": "Session cleared"})
    resp.delete_cookie("session_id")
    return resp
