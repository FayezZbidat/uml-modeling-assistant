import os
import json
import re
import requests
from dotenv import load_dotenv

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
    prompt = f"""
You are an expert UML modeler.

Convert the following English description into a valid JSON representation of a UML class diagram. Only return raw JSON — no explanation.

Input:
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
        # 🔁 שים לב – הפענוח פעמיים!
        model = json.loads(content)  # First parse: convert string to JSON dict
        return model
    except Exception as e:
        print("❌ Error parsing content:", str(e))
        return {"classes": [], "relationships": []}
