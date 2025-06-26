import os
import json
import re
import requests
from dotenv import load_dotenv
import spacy
from pathlib import Path

# Load spaCy model once
nlp = spacy.load("en_core_web_sm")

def extract_structure_from_text(text):
    doc = nlp(text)
    classes = {}
    relations = []

    for sent in doc.sents:
        subj = None
        obj = None
        verb = None

        for token in sent:
            if token.dep_ == "nsubj" and token.pos_ == "NOUN":
                subj = token.text
                classes.setdefault(subj, [])
            if token.dep_ == "dobj" and token.pos_ == "NOUN":
                obj = token.text
                classes.setdefault(obj, [])
            if token.pos_ == "VERB":
                verb = token.lemma_

        if subj and obj and verb:
            relations.append({
                "from": subj,
                "to": obj,
                "label": verb,
                "type": "association"
            })

    return {
        "classes": [{"name": name, "attributes": []} for name in classes],
        "relationships": relations
    }
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

# ✅ Use OpenAI official API endpoint
API_URL = "https://api.openai.com/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",  # Put your OpenAI key in .env as OPENAI_API_KEY
    "Content-Type": "application/json",
}

def extract_json_block(text):
    """Extracts the first JSON block (inside triple backticks or bare) from the text"""
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    match = re.search(r"(\{.*?\})", text, re.DOTALL)
    if match:
        return match.group(1)
    return None

import json

def parse_text_to_model(text, diagram_type='class'):
    heuristic_model = extract_structure_from_text(text)

    # 👇 ניסוח ההוראה לג׳יפיטי לפי סוג דיאגרמה
    if diagram_type == 'usecase':
        instruction = """
You are an expert UML modeler.

Your task is to generate a UML **Use Case Diagram** based on the system description below.
Respond with raw JSON only, without explanation or PlantUML syntax.

JSON format:
{
  "actors": ["Actor1", "Actor2"],
  "use_cases": ["UseCase1", "UseCase2"],
  "associations": [{"actor": "Actor1", "use_case": "UseCase1"}]
}
"""
    elif diagram_type == 'sequence':
        instruction = """
You are an expert UML modeler.

Your task is to extract a **UML Sequence Diagram** from the system description below.
Respond with raw JSON only.

JSON format:
{
  "participants": ["Actor", "System"],
  "messages": [{"from": "Actor", "to": "System", "message": "Login"}]
}
"""
    else:
        # default: class diagram
        instruction = """
You are an expert UML modeler.

Below is a suggested UML class model structure. Refine it and correct any inaccuracies. Respond with raw JSON only.

JSON format:
{
  "classes": [{"name": "ClassName", "attributes": ["attr1", "attr2"]}],
  "relationships": [{"from": "Class1", "to": "Class2", "type": "one-to-many", "label": "relName"}]
}
"""

    prompt = f"""{instruction}

Original input:
{text}

Heuristic model:
{json.dumps(heuristic_model, indent=2)}
"""

    body = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": prompt}]
    }

    response = requests.post(API_URL, headers=headers, json=body, timeout=15)

    if response.status_code != 200:
        print("❌ API Error:", response.status_code, response.text)
        return {}

    content = response.json()["choices"][0]["message"]["content"]
    print("🧠 Raw content:\n", repr(content))

    try:
        return json.loads(content)
    except Exception as e:
        print("❌ Error parsing content:", str(e))
        return {}

    heuristic_model = extract_structure_from_text(text)

    prompt = f"""
You are an expert UML modeler.

Below is a suggested UML model structure. Refine it and correct any inaccuracies. Respond with raw JSON only.

Heuristic model:
{json.dumps(heuristic_model, indent=2)}

Original input:
{text}

JSON format:
{{
  "classes": [{{"name": "ClassName", "attributes": ["attr1", "attr2"]}}], 
  "relationships": [{{"from": "Class1", "to": "Class2", "type": "one-to-many", "label": "relName"}}]
}}
"""
    body = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": prompt}]
    }

    response = requests.post(API_URL, headers=headers, json=body, timeout=15)

    if response.status_code != 200:
        print("❌ API Error:", response.status_code, response.text)
        return {"classes": [], "relationships": []}

    content = response.json()["choices"][0]["message"]["content"]
    print("🧠 Raw content:\n", repr(content))

    try:
        return json.loads(content)
    except Exception as e:
        print("❌ Error parsing content:", str(e))
        return {"classes": [], "relationships": []}
