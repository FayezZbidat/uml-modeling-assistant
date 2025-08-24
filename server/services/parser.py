import os
import json
import re
import requests
import spacy
from pathlib import Path
from collections import defaultdict
from typing import Dict
from dotenv import load_dotenv

# Load spaCy model once
nlp = spacy.load("en_core_web_sm")

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

API_URL = "https://api.openai.com/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
    "Content-Type": "application/json",
}

def extract_structure_from_text(text: str) -> Dict:
    """
    Heuristic extraction of UML structure from natural language.
    """
    doc = nlp(text)
    classes = defaultdict(lambda: {"attributes": [], "methods": []})
    relationships = []

    for token in doc:
        if token.pos_ in {"NOUN", "PROPN"} and token.text[0].isupper():
            classes[token.text]  # init

    model = {
        "classes": [{"name": n, "attributes": d["attributes"], "methods": d["methods"]}
                    for n, d in classes.items()],
        "relationships": relationships
    }
    if not model["classes"]:
        model["classes"] = [{"name": "Example", "attributes": ["id: int"], "methods": ["doSomething()"]}]
    return model

def extract_json_block(text: str):
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    match = re.search(r"```\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if match:
        return match.group(1)
    return None

def parse_text_to_model(text, diagram_type='class', existing_model=None):
    """Combine heuristic extraction with GPT refinement, supports merging edits."""
    heuristic_model = extract_structure_from_text(text)

    # Determine the instruction based on diagram type
    if diagram_type == 'usecase':
        instruction = "You are an expert UML modeler. Generate a Use Case Diagram JSON."
        model_structure = """{
  "actors": [],
  "use_cases": [],
  "relationships": []
}"""
    elif diagram_type == 'sequence':
        instruction = "You are an expert UML modeler. Generate a Sequence Diagram JSON."
        model_structure = """{
  "participants": [],
  "messages": []
}"""
    else:
        instruction = "You are an expert UML modeler. Generate a Class Diagram JSON."
        model_structure = """{
  "classes": [],
  "relationships": []
}"""

    if existing_model:
        # EDIT MODE - Modify existing model
        prompt = f"""{instruction}

EDIT MODE: You are modifying an existing {diagram_type} diagram.

USER'S EDIT REQUEST:
{text}

CURRENT UML MODEL (JSON):
{json.dumps(existing_model, indent=2)}

❗ IMPORTANT EDITING RULES:
1. Start from the current model above
2. Apply ONLY the requested changes from the user's edit request
3. Keep all existing elements unless explicitly removed in the edit request
4. Do NOT replace the entire model - only modify what's requested
5. Return the FULL updated JSON model including unchanged parts
6. If the edit request is unclear, make minimal changes or return the current model

Return the full updated UML model JSON only:"""
    else:
        # CREATE MODE - New diagram
        prompt = f"""{instruction}

USER'S DESCRIPTION:
{text}

Heuristic extraction (for reference only):
{json.dumps(heuristic_model, indent=2)}

Expected JSON structure for {diagram_type} diagram:
{model_structure}

Return the full UML model JSON only:"""

    body = {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1  # Lower temperature for more consistent edits
    }

    try:
        response = requests.post(API_URL, headers=headers, json=body, timeout=30)
        if response.status_code != 200:
            print("❌ API Error:", response.status_code, response.text)
            return existing_model or heuristic_model

        content = response.json()["choices"][0]["message"]["content"]
        print("🧠 Raw GPT content:\n", content)

        json_str = extract_json_block(content) or content
        
        # Clean up the JSON string
        json_str = json_str.strip()
        json_str = re.sub(r',\s*([}\]])', r'\1', json_str)  # Remove trailing commas
        
        parsed_model = json.loads(json_str)
        
        # If we're in edit mode but got a completely different structure, fall back to existing model
        if existing_model and not _models_are_compatible(existing_model, parsed_model, diagram_type):
            print("⚠️ Incompatible model structure detected, falling back to existing model")
            return existing_model
            
        return parsed_model
        
    except json.JSONDecodeError as e:
        print("❌ JSON parsing error:", str(e))
        print("❌ Failed JSON content:", json_str if 'json_str' in locals() else "N/A")
        return existing_model or heuristic_model
    except Exception as e:
        print("❌ Error parsing content:", str(e))
        return existing_model or heuristic_model

def _models_are_compatible(existing_model, new_model, diagram_type):
    """
    Check if the new model structure is compatible with the existing one.
    This prevents completely different diagram structures from replacing the original.
    """
    try:
        if diagram_type == 'class':
            return ('classes' in new_model and 
                   isinstance(new_model['classes'], list) and
                   'relationships' in new_model and
                   isinstance(new_model['relationships'], list))
        
        elif diagram_type == 'usecase':
            return ('actors' in new_model and 
                   isinstance(new_model['actors'], list) and
                   'use_cases' in new_model and
                   isinstance(new_model['use_cases'], list))
        
        elif diagram_type == 'sequence':
            return ('participants' in new_model and 
                   isinstance(new_model['participants'], list) and
                   'messages' in new_model and
                   isinstance(new_model['messages'], list))
        
        return False
        
    except:
        return False

# Helper function to merge models (optional, for more advanced editing)
def merge_models(base_model, changes_model, diagram_type):
    """
    Merge changes into base model. This is a more advanced approach
    that could be used for specific edit operations.
    """
    if not base_model:
        return changes_model
        
    if diagram_type == 'class':
        merged = {
            "classes": base_model.get("classes", []),
            "relationships": base_model.get("relationships", [])
        }
        
        # Apply changes (this would need more sophisticated logic)
        if "classes" in changes_model:
            for new_class in changes_model["classes"]:
                # Check if class already exists
                existing_idx = next((i for i, cls in enumerate(merged["classes"]) 
                                   if cls["name"] == new_class["name"]), -1)
                if existing_idx >= 0:
                    # Update existing class
                    merged["classes"][existing_idx].update(new_class)
                else:
                    # Add new class
                    merged["classes"].append(new_class)
        
        if "relationships" in changes_model:
            merged["relationships"].extend(changes_model["relationships"])
            
        return merged
        
    # Similar logic for other diagram types...
    return base_model