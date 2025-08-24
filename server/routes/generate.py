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

def get_session_id(req):
    sid = req.cookies.get("session_id")
    if not sid:
        sid = str(uuid.uuid4())
    return sid

def extract_plantuml_blocks(text: str) -> str:
    """
    Extract valid PlantUML (@startuml ... @enduml).
    Ignores ASCII-art or Markdown boxes.
    """
    match = re.findall(r'@startuml[\s\S]*?@enduml', text)
    if match:
        return "\n".join(match)
    return ""

def extract_json_block(text: str):
    """
    Extract JSON object from GPT output (fenced, inline, etc.).
    Returns JSON string or None.
    """
    # 1️⃣ ```json ... ```
    match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if match:
        candidate = match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except:
            pass

    # 2️⃣ ``` ... ```
    match = re.search(r'```\s*([\s\S]*?)\s*```', text)
    if match:
        candidate = match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except:
            pass

    # 3️⃣ Largest {...}
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

@generate_bp.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    text = data.get("text", "").strip()
    diagram_type = data.get("type", "class").strip().lower()
    diagram_id = data.get("diagram_id")

    print("📥 Received text:", text)
    print("📘 Diagram type:", diagram_type)
    print("📊 Diagram ID:", diagram_id)

    session_id = get_session_id(request)
    
    # Load conversation from database
    session = ConversationSession.query.get(session_id)
    if session:
        conversation = json.loads(session.messages)
    else:
        conversation = []
        session = ConversationSession(
            id=session_id,
            diagram_id=diagram_id,
            messages=json.dumps(conversation)
        )
        db.session.add(session)

    # If we have a diagram_id, load the existing content for context
    existing_content = None
    if diagram_id:
        diagram = Diagram.query.get(diagram_id)
        if diagram:
            existing_content = diagram.plantuml_code
            # Add context about what we're editing if not already present
            if not any(msg.get("role") == "system" and "EDIT MODE" in msg.get("content", "") for msg in conversation):
                edit_context = f"""EDIT MODE: You are editing an existing {diagram.diagram_type} diagram.
Current diagram content:
{diagram.plantuml_code}

When the user asks to edit, modify the existing diagram instead of creating a new one."""
                conversation.insert(0, {"role": "system", "content": edit_context})

    # System instruction with edit context
    if not any(msg.get("role") == "system" for msg in conversation):
        if diagram_type == "usecase":
            system_instruction = "You are an assistant that generates UML Use Case Diagrams. Always output JSON or PlantUML."
        elif diagram_type == "sequence":
            system_instruction = "You are an assistant that generates UML Sequence Diagrams. Always output JSON or PlantUML."
        else:
            system_instruction = "You are an assistant that generates UML Class Diagrams. Always output JSON or PlantUML."
        
        if existing_content:
            system_instruction += f"\n\nEDIT MODE: You are editing an existing diagram. Current content:\n{existing_content}"
        
        conversation.insert(0, {"role": "system", "content": system_instruction})

    conversation.append({"role": "user", "content": text})

    # Quick validation
    if len(text.split()) < 3:
        return make_response(jsonify({
            "plantuml": "",
            "model": {},
            "explanation": "❗ Please describe a system."
        }), 200)

    try:
        # Call GPT with the full conversation history
        response = client.chat.completions.create(
            model="gpt-4",
            messages=conversation
        )
        reply = response.choices[0].message.content
        print("🤖 GPT reply:", reply)

        # Debug checks
        plantuml_code = extract_plantuml_blocks(reply)
        json_block = extract_json_block(reply)
        print("🔎 Extracted PlantUML:", bool(plantuml_code))
        print("🔎 Extracted JSON:", bool(json_block))

        # Add assistant reply to conversation
        conversation.append({"role": "assistant", "content": reply})
        
        # Save updated conversation to database
        session.messages = json.dumps(conversation)
        session.diagram_id = diagram_id
        db.session.commit()

        explanation = reply.strip()
        model = None

        # 1️⃣ GPT gave PlantUML
        if plantuml_code:
            model = parse_text_to_model(text, diagram_type)

        # 2️⃣ JSON → PlantUML
        if not plantuml_code:
            if json_block:
                print("✅ Extracted JSON block:\n", json_block)
                try:
                    model = json.loads(json_block)
                    print("✅ Parsed JSON successfully")
                    plantuml_code = generate_plantuml(model, diagram_type)
                    print("✅ Generated PlantUML:\n", plantuml_code)
                    explanation += "\n\n✅ Generated PlantUML from JSON model."
                except Exception as e:
                    print("❌ JSON parse error:", e)

        # 3️⃣ Force parser if still nothing
        if not plantuml_code:
            model = parse_text_to_model(text, diagram_type, existing_model=model)
            if model:
                plantuml_code = generate_plantuml(model, diagram_type)
                print("✅ Generated PlantUML from parsed text model:\n", plantuml_code)
                explanation += "\n\n✅ Generated PlantUML from parsed text model."

        # 4️⃣ Final fallback
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
  +borrowBook()
  +returnBook()
}
class Book {
  +ISBN
  +title
  +author
}
class Librarian {
  +addBook()
  +removeBook()
}
class Borrowing {
  +borrowingDate
  +returnDate
}
User "1" -- "*" Borrowing
Book "1" -- "*" Borrowing
Librarian --|> User
@enduml"""

        # ✅ Save to DB
        if diagram_id:
            diagram = Diagram.query.get(diagram_id)
            if diagram:
                diagram.plantuml_code = plantuml_code.strip()
                diagram.flow_data = json.dumps(model) if model else None
                db.session.commit()
        else:
            new_diagram = Diagram(
                id=str(uuid.uuid4()),
                name="Generated Diagram",
                diagram_type=diagram_type,
                plantuml_code=plantuml_code.strip(),
                flow_data=json.dumps(model) if model else None
            )
            db.session.add(new_diagram)
            db.session.commit()
            diagram_id = new_diagram.id

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
            "explanation": f"❌ Error: {str(e)}"
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