def generate_plantuml(model, diagram_type="class"):
    """
    Enhanced PlantUML generator that creates more accurate and feature-rich diagrams.
    """
    lines = ["@startuml"]
    
    if diagram_type == "class":
        # Add skinparam for better visuals
        lines.extend([
            "skinparam classAttributeIconSize 0",
            "skinparam class {",
            "  BackgroundColor LightBlue",
            "  BorderColor DarkBlue",
            "  ArrowColor DarkBlue",
            "}",
            ""
        ])
        
        # Generate classes with attributes and methods
        for cls in model.get("classes", []):
            class_name = cls['name']
            attributes = cls.get("attributes", [])
            methods = cls.get("methods", [])
            
            lines.append(f"class {class_name} {{")
            
            # Add attributes with visibility and types if available
            if attributes:
                for attr in attributes:
                    # Check if attribute has type information
                    if ":" in attr:
                        lines.append(f"  +{attr}")
                    else:
                        lines.append(f"  +{attr}")
            
            # Add separator between attributes and methods
            if attributes and methods:
                lines.append("  --")
            
            # Add methods
            if methods:
                for method in methods:
                    # Ensure method has parentheses
                    if "(" not in method:
                        method = method + "()"
                    lines.append(f"  +{method}")
            
            lines.append("}")
            lines.append("")
        
        # Generate relationships with proper notation
        for rel in model.get("relationships", []):
            from_class = rel["from"]
            to_class = rel["to"]
            rel_type = rel.get("type", "association")
            label = rel.get("label", "")
            
            # Map relationship types to PlantUML notation
            if rel_type == "inheritance":
                # Inheritance arrow (empty triangle)
                lines.append(f"{from_class} --|> {to_class}")
            elif rel_type == "composition":
                # Composition (filled diamond)
                lines.append(f"{from_class} *-- {to_class} : {label}".strip())
            elif rel_type == "aggregation":
                # Aggregation (empty diamond)
                lines.append(f"{from_class} o-- {to_class} : {label}".strip())
            elif rel_type == "one-to-many":
                lines.append(f'{from_class} "1" --> "*" {to_class} : {label}'.strip())
            elif rel_type == "many-to-one":
                lines.append(f'{from_class} "*" --> "1" {to_class} : {label}'.strip())
            elif rel_type == "many-to-many":
                lines.append(f'{from_class} "*" --> "*" {to_class} : {label}'.strip())
            elif rel_type == "one-to-one":
                lines.append(f'{from_class} "1" --> "1" {to_class} : {label}'.strip())
            else:
                # Default association
                if label:
                    lines.append(f"{from_class} --> {to_class} : {label}")
                else:
                    lines.append(f"{from_class} --> {to_class}")
    
    elif diagram_type == "usecase":
        # Add skinparam for better visuals
        lines.extend([
            "left to right direction",
            "skinparam packageStyle rectangle",
            "skinparam usecase {",
            "  BackgroundColor LightYellow",
            "  BorderColor DarkGoldenRod",
            "}",
            ""
        ])
        
        # Create a system boundary if there are use cases
        if model.get("use_cases"):
            lines.append("rectangle System {")
        
        # Add actors
        for actor in model.get("actors", []):
            lines.append(f"actor {actor}")
        
        lines.append("")
        
        # Add use cases
        for uc in model.get("use_cases", []):
            # Clean use case name for ID
            uc_id = f"UC_{uc.replace(' ', '_').replace('-', '_')}"
            lines.append(f'usecase "{uc}" as {uc_id}')
        
        # Close system boundary
        if model.get("use_cases"):
            lines.append("}")
            lines.append("")
        
        # Add associations
        for assoc in model.get("associations", []):
            actor = assoc.get("actor")
            use_case = assoc.get("use_case")
            if actor and use_case:
                uc_id = f"UC_{use_case.replace(' ', '_').replace('-', '_')}"
                lines.append(f"{actor} --> {uc_id}")
        
        # Add include/extend relationships if present
        for inc in model.get("includes", []):
            from_uc = f"UC_{inc['from'].replace(' ', '_').replace('-', '_')}"
            to_uc = f"UC_{inc['to'].replace(' ', '_').replace('-', '_')}"
            lines.append(f"{from_uc} ..> {to_uc} : <<include>>")
        
        for ext in model.get("extends", []):
            from_uc = f"UC_{ext['from'].replace(' ', '_').replace('-', '_')}"
            to_uc = f"UC_{ext['to'].replace(' ', '_').replace('-', '_')}"
            lines.append(f"{from_uc} ..> {to_uc} : <<extend>>")
    
    elif diagram_type == "sequence":
        # Add skinparam for better visuals
        lines.extend([
            "skinparam sequence {",
            "  ArrowColor DarkBlue",
            "  ActorBorderColor DarkBlue",
            "  LifeLineBorderColor DarkBlue",
            "  ParticipantBorderColor DarkBlue",
            "}",
            ""
        ])
        
        # Add participants with better formatting
        participants = model.get("participants", [])
        for i, p in enumerate(participants):
            # Determine participant type
            if p.lower() in ["user", "admin", "customer", "client"]:
                lines.append(f"actor {p}")
            elif p.lower() in ["database", "db"]:
                lines.append(f"database {p}")
            else:
                lines.append(f"participant {p}")
        
        lines.append("")
        
        # Add messages with proper formatting
        for msg in model.get("messages", []):
            from_p = msg.get("from", "")
            to_p = msg.get("to", "")
            message = msg.get("message", "")
            msg_type = msg.get("type", "sync")
            
            # Format message based on type
            if msg_type == "async":
                lines.append(f"{from_p} ->> {to_p} : {message}")
            elif msg_type == "return":
                lines.append(f"{from_p} -->> {to_p} : {message}")
            elif msg_type == "create":
                lines.append(f"{from_p} ->** {to_p} : {message}")
            elif msg_type == "destroy":
                lines.append(f"{from_p} ->!! {to_p} : {message}")
            else:
                # Default synchronous message
                lines.append(f"{from_p} -> {to_p} : {message}")
        
        # Add activation bars if present
        for act in model.get("activations", []):
            lines.append(f"activate {act['participant']}")
            if act.get("deactivate"):
                lines.append(f"deactivate {act['participant']}")
    
    else:
        lines.append("' Unsupported diagram type")
        lines.append(f"note: Diagram type '{diagram_type}' is not supported")
    
    lines.append("@enduml")
    return "\n".join(lines)