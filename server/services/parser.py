import os
import json
import re
import requests
from dotenv import load_dotenv
import spacy
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Set, Tuple

# Load spaCy model once
nlp = spacy.load("en_core_web_sm")

def extract_structure_from_text(text: str) -> Dict:
    """
    Enhanced extraction of UML structure from natural language text.
    Improves upon the basic subject-verb-object extraction with:
    - Better attribute detection
    - Inheritance and composition recognition
    - Multiplicity extraction
    - Method detection
    - Better handling of complex sentences
    """
    doc = nlp(text)
    
    classes = defaultdict(lambda: {"attributes": [], "methods": []})
    relationships = []
    
    # Pattern matching for common UML descriptions
    inheritance_verbs = {"inherit", "extend", "derive", "subclass", "is-a", "is a"}
    composition_verbs = {"contain", "compose", "has-a", "has a", "include", "consist"}
    association_verbs = {"connect", "relate", "link", "associate", "use", "reference"}
    
    # Extract classes and their properties
    for sent in doc.sents:
        # Extract class definitions (e.g., "A User has id, name, and email")
        extract_class_with_attributes(sent, classes)
        
        # Extract methods (e.g., "User can login and logout")
        extract_methods(sent, classes)
        
        # Extract relationships
        extract_relationships(sent, classes, relationships, 
                           inheritance_verbs, composition_verbs, association_verbs)
    
    # Post-process to extract multiplicity and clean up
    relationships = post_process_relationships(relationships)
    
    # Convert to expected format
    return {
        "classes": [
            {
                "name": name,
                "attributes": info["attributes"],
                "methods": info["methods"]
            }
            for name, info in classes.items()
        ],
        "relationships": relationships
    }

def extract_class_with_attributes(sent, classes: Dict):
    """Extract classes and their attributes from sentences."""
    
    # Pattern 1: "A/The [Class] has/contains [attr1], [attr2], and [attr3]"
    has_pattern = False
    for token in sent:
        if token.lemma_ in ["have", "contain", "include"] and token.pos_ == "VERB":
            has_pattern = True
            # Find the subject (class name)
            subj = None
            for child in token.children:
                if child.dep_ in ["nsubj", "nsubjpass"]:
                    subj = child
                    break
            
            if subj:
                class_name = extract_compound_noun(subj)
                classes[class_name]["attributes"]  # Initialize if needed
                
                # Find attributes (objects of the verb)
                for child in token.children:
                    if child.dep_ in ["dobj", "attr"]:
                        # Extract all items in a list
                        attrs = extract_list_items(child)
                        classes[class_name]["attributes"].extend(attrs)
    
    # Pattern 2: "Class: attribute1, attribute2" or "Class - attribute1, attribute2"
    text = sent.text
    colon_match = re.match(r"(\w+)\s*[:–-]\s*(.+)", text)
    if colon_match:
        class_name = colon_match.group(1)
        attrs_text = colon_match.group(2)
        attrs = [attr.strip() for attr in re.split(r"[,;]", attrs_text)]
        classes[class_name]["attributes"].extend(attrs)
    
    # Pattern 3: Detect classes from noun phrases that look like class names
    for chunk in sent.noun_chunks:
        # Check if this looks like a class name (capitalized, singular)
        if chunk.root.pos_ == "NOUN" and chunk.text[0].isupper():
            class_name = chunk.text
            if class_name not in classes:
                classes[class_name]["attributes"]  # Initialize

def extract_methods(sent, classes: Dict):
    """Extract methods/operations from sentences."""
    
    # Pattern: "[Class] can/should/must [method1], [method2]"
    for token in sent:
        if token.lemma_ in ["can", "should", "must", "able"] and token.pos_ in ["AUX", "VERB"]:
            # Find subject (class)
            subj = None
            for child in token.children:
                if child.dep_ == "nsubj":
                    subj = child
                    break
            
            if subj:
                class_name = extract_compound_noun(subj)
                
                # Find methods (usually infinitive verbs after modal)
                for child in token.children:
                    if child.pos_ == "VERB":
                        method_name = child.lemma_ + "()"
                        classes[class_name]["methods"].append(method_name)
                        
                        # Check for coordinated verbs (e.g., "login and logout")
                        for conj in child.children:
                            if conj.dep_ == "conj" and conj.pos_ == "VERB":
                                classes[class_name]["methods"].append(conj.lemma_ + "()")

def extract_relationships(sent, classes: Dict, relationships: List, 
                        inheritance_verbs: Set, composition_verbs: Set, 
                        association_verbs: Set):
    """Extract different types of relationships between classes."""
    
    for token in sent:
        if token.pos_ == "VERB":
            verb_lemma = token.lemma_
            
            # Find subject and object
            subj = None
            obj = None
            
            for child in token.children:
                if child.dep_ in ["nsubj", "nsubjpass"]:
                    subj = child
                elif child.dep_ in ["dobj", "pobj", "attr"]:
                    obj = child
            
            if subj and obj:
                from_class = extract_compound_noun(subj)
                to_class = extract_compound_noun(obj)
                
                # Skip if these don't look like class names
                if not (from_class[0].isupper() and to_class[0].isupper()):
                    continue
                
                # Ensure classes exist
                classes[from_class]["attributes"]
                classes[to_class]["attributes"]
                
                # Determine relationship type
                rel_type = "association"
                if verb_lemma in inheritance_verbs:
                    rel_type = "inheritance"
                elif verb_lemma in composition_verbs:
                    rel_type = "composition"
                
                # Extract multiplicity from the sentence
                multiplicity = extract_multiplicity(sent, from_class, to_class)
                
                relationships.append({
                    "from": from_class,
                    "to": to_class,
                    "type": multiplicity if multiplicity != "association" else rel_type,
                    "label": verb_lemma if rel_type == "association" else ""
                })

def extract_compound_noun(token) -> str:
    """Extract compound nouns (e.g., 'User Account' instead of just 'Account')."""
    parts = []
    
    # Get all compound parts
    for child in token.children:
        if child.dep_ == "compound":
            parts.append(child.text)
    
    parts.append(token.text)
    
    # Join and clean
    compound = " ".join(parts)
    
    # Handle determiners
    if token.dep_ == "nsubj":
        for child in token.children:
            if child.dep_ == "det" and child.text.lower() in ["a", "an", "the"]:
                return compound
    
    return compound

def extract_list_items(token) -> List[str]:
    """Extract items from a list structure (e.g., 'id, name, and email')."""
    items = [token.text]
    
    # Look for conjunctions
    for child in token.children:
        if child.dep_ == "conj":
            items.append(child.text)
    
    return items

def extract_multiplicity(sent, from_class: str, to_class: str) -> str:
    """Extract multiplicity information from the sentence."""
    text = sent.text.lower()
    
    # Common multiplicity patterns
    patterns = [
        (r"one\s+" + from_class.lower() + r".*many\s+" + to_class.lower(), "one-to-many"),
        (r"many\s+" + from_class.lower() + r".*one\s+" + to_class.lower(), "many-to-one"),
        (r"many\s+" + from_class.lower() + r".*many\s+" + to_class.lower(), "many-to-many"),
        (r"each\s+" + from_class.lower() + r".*multiple\s+" + to_class.lower(), "one-to-many"),
        (r"single\s+" + from_class.lower() + r".*multiple\s+" + to_class.lower(), "one-to-many"),
    ]
    
    for pattern, mult_type in patterns:
        if re.search(pattern, text):
            return mult_type
    
    # Check for plural forms indicating many
    doc = nlp(sent.text)
    for token in doc:
        if token.text.lower() == to_class.lower() and token.tag_ in ["NNS", "NNPS"]:
            return "one-to-many"
    
    return "association"

def post_process_relationships(relationships: List[Dict]) -> List[Dict]:
    """Clean up and deduplicate relationships."""
    seen = set()
    unique_rels = []
    
    for rel in relationships:
        key = (rel["from"], rel["to"], rel["type"])
        if key not in seen:
            seen.add(key)
            
            # Clean up relationship type for UML
            if rel["type"] == "inheritance":
                rel["type"] = "inheritance"
                rel["label"] = ""  # No label for inheritance
            elif rel["type"] == "composition":
                rel["type"] = "composition"
                rel["label"] = ""
            elif rel["type"] in ["one-to-many", "many-to-one", "many-to-many", "one-to-one"]:
                # Keep multiplicity as type
                pass
            else:
                # Default association
                rel["type"] = "association"
            
            unique_rels.append(rel)
    
    return unique_rels

# Keep the existing API functions unchanged
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

API_URL = "https://api.openai.com/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
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

def parse_text_to_model(text, diagram_type='class'):
    """Main function that combines NLP extraction with GPT refinement."""
    heuristic_model = extract_structure_from_text(text)
    
    # Enhanced prompts for each diagram type
    if diagram_type == 'usecase':
        instruction = """
You are an expert UML modeler.

Your task is to generate a UML **Use Case Diagram** based on the system description below.
Focus on identifying actors (users, systems, external entities) and their use cases (actions they can perform).
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
Focus on the order of interactions between participants.
Respond with raw JSON only.

JSON format:
{
  "participants": ["Actor", "System"],
  "messages": [{"from": "Actor", "to": "System", "message": "Login"}]
}
"""
    else:
        # Enhanced class diagram instruction
        instruction = """
You are an expert UML modeler.

Below is a suggested UML class model structure. Refine it by:
1. Ensuring all class names are properly capitalized
2. Adding any missing attributes or methods mentioned in the text
3. Correcting relationship types (inheritance, composition, aggregation, association)
4. Adding proper multiplicities (one-to-one, one-to-many, many-to-many)
5. Including method signatures where mentioned

Respond with raw JSON only.

JSON format:
{
  "classes": [{"name": "ClassName", "attributes": ["attr1: type", "attr2: type"], "methods": ["method1()", "method2(param: type): returnType"]}],
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
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3  # Lower temperature for more consistent output
    }

    try:
        response = requests.post(API_URL, headers=headers, json=body, timeout=15)
        
        if response.status_code != 200:
            print("❌ API Error:", response.status_code, response.text)
            return heuristic_model  # Return NLP-only results as fallback
        
        content = response.json()["choices"][0]["message"]["content"]
        print("🧠 Raw content:\n", repr(content))
        
        # Try to extract JSON from the response
        json_str = extract_json_block(content) or content
        
        return json.loads(json_str)
    except Exception as e:
        print("❌ Error parsing content:", str(e))
        return heuristic_model  # Return NLP-only results as fallback