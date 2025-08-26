import os
import re
import json
import requests
import spacy
from pathlib import Path
from collections import defaultdict
from typing import Dict
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

API_URL = "https://api.openai.com/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
    "Content-Type": "application/json",
}

# Load spaCy once
nlp = spacy.load("en_core_web_sm")

# ----------------------------
# Helpers
# ----------------------------

def extract_structure_from_text(text: str) -> Dict:
    """Very simple heuristic extraction of nouns for class diagrams only."""
    doc = nlp(text)
    classes = defaultdict(lambda: {"attributes": [], "methods": []})
    relationships = []

    for token in doc:
        if token.pos_ in {"NOUN", "PROPN"} and token.text[0].isupper():
            classes[token.text]  # init

    return {
        "classes": [{"name": n, "attributes": d["attributes"], "methods": d["methods"]}
                    for n, d in classes.items()],
        "relationships": relationships
    }

def extract_json_block(text: str):
    """Extract JSON from GPT output (fenced or inline)."""
    match = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", text)
    if match:
        return match.group(1)
    match = re.search(r"```[\s\S]*?```", text)
    if match:
        return match.group(1).strip("`")
    match = re.search(r"(\{[\s\S]*\})", text)
    if match:
        return match.group(1)
    return None

# ----------------------------
# Main parser
# ----------------------------

def parse_text_to_model(text, diagram_type="class", existing_model=None):
    """
    Parse natural language description into a UML model (JSON).
    Supports class, usecase, and sequence diagrams.
    If existing_model is provided → EDIT MODE (apply changes).
    """
    # Heuristic model only makes sense for class
    heuristic_model = extract_structure_from_text(text) if diagram_type == "class" else {}

    # Prompt per type
    if diagram_type == "usecase":
        instruction = "You are an expert UML modeler. Generate a Use Case Diagram JSON."
        model_structure = """{
  "actors": ["User"],
  "use_cases": ["Login"],
  "associations": [{"actor": "User", "use_case": "Login"}],
  "includes": [],
  "extends": []
}"""
    elif diagram_type == "sequence":
        instruction = "You are an expert UML modeler. Generate a Sequence Diagram JSON."
        model_structure = """{
  "participants": ["User", "System"],
  "messages": [
    {"from": "User", "to": "System", "message": "Login request", "type": "sync"},
    {"from": "System", "to": "User", "message": "Success", "type": "return"}
  ],
  "activations": []
}"""
    else:  # class
        instruction = "You are an expert UML modeler. Generate a Class Diagram JSON."
        model_structure = """{
  "classes": [
    {"name": "User", "attributes": ["id: int", "name: string"], "methods": ["login()", "logout()"]},
    {"name": "Book", "attributes": ["isbn: string", "title: string"], "methods": []}
  ],
  "relationships": [
    {"from": "User", "to": "Book", "type": "association", "label": "borrows"}
  ]
}"""

    # EDIT MODE
    if existing_model:
        prompt = f"""{instruction}

EDIT MODE:
You are modifying an existing {diagram_type} diagram.
USER REQUEST: {text}
CURRENT MODEL (JSON):
{json.dumps(existing_model, indent=2)}

RULES:
1. Keep all existing elements unless explicitly removed
2. Apply ONLY requested changes
3. Return the FULL updated JSON, not just the changes
"""
    else:
        # CREATE MODE
        prompt = f"""{instruction}

USER DESCRIPTION:
{text}

Start from this JSON skeleton:
{model_structure}

Return the full JSON model only.
"""

    body = {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    }

    try:
        response = requests.post(API_URL, headers=headers, json=body, timeout=30)
        if response.status_code != 200:
            print("❌ API Error:", response.status_code, response.text)
            return existing_model or heuristic_model

        content = response.json()["choices"][0]["message"]["content"]
        print("🧠 Raw GPT content:\n", content)

        json_str = extract_json_block(content) or content
        json_str = json_str.strip()
        json_str = re.sub(r",\s*([}\]])", r"\1", json_str)  # remove trailing commas

        parsed_model = json.loads(json_str)

        # Compatibility check
        if existing_model and not _models_are_compatible(existing_model, parsed_model, diagram_type):
            print("⚠️ Incompatible model, fallback to existing")
            return existing_model

        return parsed_model

    except Exception as e:
        print("❌ Parser error:", str(e))
        return existing_model or heuristic_model

# ----------------------------
# Compatibility check
# ----------------------------

def _models_are_compatible(existing_model, new_model, diagram_type):
    """Ensure new model matches schema for the given type."""
    try:
        if diagram_type == "class":
            return "classes" in new_model and "relationships" in new_model
        elif diagram_type == "usecase":
            return "actors" in new_model and "use_cases" in new_model
        elif diagram_type == "sequence":
            return "participants" in new_model and "messages" in new_model
        return False
    except:
        return False
