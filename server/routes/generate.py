from flask import Blueprint, request, jsonify, make_response
from openai import OpenAI
import uuid
from services.parser import parse_text_to_model
from utils.plantuml import generate_plantuml
from dotenv import load_dotenv
import os

load_dotenv()

generate_bp = Blueprint('generate', __name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SESSION_STORE = {}

def get_session_id(req):
    sid = req.cookies.get("session_id")
    if not sid:
        sid = str(uuid.uuid4())
    return sid

@generate_bp.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    text = data.get("text", "").strip()
    diagram_type = data.get("type", "class").strip().lower()  # ✅ קבלת סוג הדיאגרמה

    print("📥 Received text:", text)
    print("📘 Diagram type:", diagram_type)

    session_id = get_session_id(request)
    conversation = SESSION_STORE.get(session_id, [])

    if len(text.split()) < 3:
        return make_response(jsonify({
            "plantuml": "",
            "model": {},
            "explanation": "❗ Please describe a system."
        }), 200)

    # ✅ יצירת הנחיה מותאמת לפי סוג הדיאגרמה
    if diagram_type == "usecase":
        system_instruction = (
            "You are a helpful assistant that generates UML **Use Case Diagrams** based on user descriptions.\n"
            "Respond with:\n1. A short explanation.\n2. UML code inside ```plantuml ... ```.\n"
            "Use syntax like: actor, usecase, and --> arrows."
        )
    elif diagram_type == "sequence":
        system_instruction = (
            "You are a helpful assistant that generates UML **Sequence Diagrams** from user descriptions.\n"
            "Respond with:\n1. An explanation.\n2. UML code inside ```plantuml ... ```.\n"
            "Use syntax like: participant, ->, and messages in order."
        )
    else:
        system_instruction = (
            "You are a helpful assistant that extracts UML **Class Diagrams** from user descriptions.\n"
            "Respond with:\n1. An explanation.\n2. UML code inside ```plantuml ... ```.\n"
            "Use syntax like: class, attributes and relationships."
        )

    if not conversation:
        conversation.append({
            "role": "system",
            "content": system_instruction
        })

    conversation.append({ "role": "user", "content": text })

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=conversation
        )
        reply = response.choices[0].message.content
        print("🤖 GPT reply:", reply)

        conversation.append({ "role": "assistant", "content": reply })
        SESSION_STORE[session_id] = conversation

        if "```plantuml" in reply:
            explanation, plantuml_code = reply.split("```plantuml", 1)
            plantuml_code = plantuml_code.strip("`\n ")
        else:
            explanation = reply
            plantuml_code = ""

        # ✅ fallback לפי סוג הדיאגרמה
        if not plantuml_code:
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
}
class Post {
  +id
  +content
}
User "1" -- "*" Post : writes
@enduml"""
            explanation += "\n\n✅ This is a fallback example diagram."

        # ✅ יצירת מודל פנימי לפי הסוג
        model = parse_text_to_model(text, diagram_type)
        generated_code = generate_plantuml(model)  # ⚠️ ניתן לשנות בהמשך לפי הסוג

        resp = make_response(jsonify({
            "plantuml": plantuml_code.strip(),
            "model": model,
            "explanation": explanation.strip()
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