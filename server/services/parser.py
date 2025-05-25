import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # ✅ Load .env from root of project
print("🔐 Loaded API Key:", os.getenv("OPENAI_API_KEY")[:10] + "...")

# ✅ Explicitly pass API key to OpenAI client
client = OpenAI(api_key=os.getenv("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"))

def parse_text_to_model(text):
    prompt = f"""
Turn this into a UML class diagram structure:

"{text}"

Respond in this JSON format:
{{
  "classes": [
    {{"name": "ClassName", "attributes": ["attr1", "attr2"]}}
  ],
  "relationships": [
    {{"from": "ClassA", "to": "ClassB", "type": "one-to-many", "label": "relationship"}}
  ]
}}
"""

    response = client.chat.completions.create(
model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )

    return eval(response.choices[0].message.content)
