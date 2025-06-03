import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://openrouter.ai/api/v1/chat/completions"  # or Hugging Face
headers = {
    "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",  # or HUGGINGFACE
    "Content-Type": "application/json",
}

def extract_json_block(text):
    """Extracts the first JSON block (inside triple backticks or bare) from the text"""
    # Try to extract ```json ... ``` block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)

    # Fallback: try to extract first {...} JSON block manually
    match = re.search(r"(\{.*?\})", text, re.DOTALL)
    if match:
        return match.group(1)

    return None

def parse_text_to_model(text):
    prompt = f"""
Convert this to a UML class diagram structure in valid JSON format only.

Input: "{text}"

Respond with only valid JSON like:
{{
  "classes": [{{"name": "X", "attributes": ["a", "b"]}}],
  "relationships": [{{"from": "X", "to": "Y", "type": "one-to-many", "label": "has"}}]
}}
"""

    body = {
        "model": "mistralai/mistral-7b-instruct",
        "messages": [{"role": "user", "content": prompt}]
    }

    response = requests.post(API_URL, headers=headers, json=body, timeout=15)

    if response.status_code != 200:
        print("❌ API Error:", response.status_code, response.text)
        return {"classes": [], "relationships": []}

    content = response.json()["choices"][0]["message"]["content"]
    print("🧠 Raw content:\n", repr(content))

    extracted_json = extract_json_block(content)
    if not extracted_json:
        print("❌ Could not extract JSON block")
        return {"classes": [], "relationships": []}

    try:
        model = json.loads(extracted_json)
        return model
    except Exception as e:
        print("❌ Error parsing extracted JSON:", str(e))
        print("🔍 Extracted:", extracted_json)
        return {"classes": [], "relationships": []}
