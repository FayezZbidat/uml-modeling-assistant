import os
import json
import re
import requests
from dotenv import load_dotenv
import spacy

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
load_dotenv()

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

def parse_text_to_model(text):
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
