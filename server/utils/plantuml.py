def generate_plantuml(model, diagram_type="class"):
    """
    Enhanced PlantUML generator for Class, Use Case, and Sequence diagrams.
    Handles attributes, methods, relationships, actors, use cases, associations, participants, and messages.
    """
    lines = ["@startuml"]

    # ----------------------------
    # CLASS DIAGRAM
    # ----------------------------
    if diagram_type == "class":
        lines.extend([
            "skinparam classAttributeIconSize 0",
            "skinparam class {",
            "  BackgroundColor LightBlue",
            "  BorderColor DarkBlue",
            "  ArrowColor DarkBlue",
            "}",
            ""
        ])

        # Classes
        for cls in model.get("classes", []):
            class_name = cls["name"]
            attributes = cls.get("attributes", [])
            methods = cls.get("methods", [])

            lines.append(f"class {class_name} {{")
            for attr in attributes:
                lines.append(f"  +{attr}")
            if attributes and methods:
                lines.append("  --")
            for method in methods:
                if "(" not in method:
                    method += "()"
                lines.append(f"  +{method}")
            lines.append("}")
            lines.append("")

        # Relationships
        for rel in model.get("relationships", []):
            from_class = rel["from"]
            to_class = rel["to"]
            rel_type = rel.get("type", "association")
            label = rel.get("label", "")

            if rel_type == "inheritance":
                lines.append(f"{from_class} --|> {to_class}")
            elif rel_type == "composition":
                lines.append(f"{from_class} *-- {to_class} : {label}".strip())
            elif rel_type == "aggregation":
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
                if label:
                    lines.append(f"{from_class} --> {to_class} : {label}")
                else:
                    lines.append(f"{from_class} --> {to_class}")

    # ----------------------------
    # USE CASE DIAGRAM
    # ----------------------------
    elif diagram_type == "usecase":
        lines.extend([
            "left to right direction",
            "skinparam packageStyle rectangle",
            "skinparam usecase {",
            "  BackgroundColor LightYellow",
            "  BorderColor DarkGoldenRod",
            "}",
            ""
        ])

        actors = model.get("actors", [])
        use_cases = model.get("use_cases", [])
        associations = model.get("associations", [])
        includes = model.get("includes", [])
        extends = model.get("extends", [])

        # Actors
        for actor in actors:
            lines.append(f"actor {actor}")
        if actors:
            lines.append("")

        # Use Cases
        if use_cases:
            lines.append("rectangle System {")
            for uc in use_cases:
                uc_id = f"UC_{uc.replace(' ', '_')}"
                lines.append(f'  usecase "{uc}" as {uc_id}')
            lines.append("}")
            lines.append("")

        # Associations
        for assoc in associations:
            actor = assoc.get("actor")
            use_case = assoc.get("use_case")
            if actor and use_case:
                uc_id = f"UC_{use_case.replace(' ', '_')}"
                lines.append(f"{actor} --> {uc_id}")

        # Include/Extend
        for inc in includes:
            from_uc = f"UC_{inc['from'].replace(' ', '_')}"
            to_uc = f"UC_{inc['to'].replace(' ', '_')}"
            lines.append(f"{from_uc} ..> {to_uc} : <<include>>")

        for ext in extends:
            from_uc = f"UC_{ext['from'].replace(' ', '_')}"
            to_uc = f"UC_{ext['to'].replace(' ', '_')}"
            lines.append(f"{from_uc} ..> {to_uc} : <<extend>>")

    # ----------------------------
    # SEQUENCE DIAGRAM
    # ----------------------------
    elif diagram_type == "sequence":
        lines.extend([
            "skinparam sequence {",
            "  ArrowColor DarkBlue",
            "  ActorBorderColor DarkBlue",
            "  LifeLineBorderColor DarkBlue",
            "  ParticipantBorderColor DarkBlue",
            "}",
            ""
        ])

        participants = model.get("participants", [])
        messages = model.get("messages", [])
        activations = model.get("activations", [])

        # Participants
        for p in participants:
            if p.lower() in ["user", "admin", "customer", "client"]:
                lines.append(f"actor {p}")
            elif p.lower() in ["database", "db"]:
                lines.append(f"database {p}")
            else:
                lines.append(f"participant {p}")
        if participants:
            lines.append("")

        # Messages
        for msg in messages:
            from_p = msg.get("from", "")
            to_p = msg.get("to", "")
            message = msg.get("message", "")
            msg_type = msg.get("type", "sync")

            if msg_type == "async":
                lines.append(f"{from_p} ->> {to_p} : {message}")
            elif msg_type == "return":
                lines.append(f"{from_p} -->> {to_p} : {message}")
            elif msg_type == "create":
                lines.append(f"{from_p} -> ** {to_p} : {message}")
            elif msg_type == "destroy":
                lines.append(f"{from_p} -> !! {to_p} : {message}")
            else:
                lines.append(f"{from_p} -> {to_p} : {message}")

        # Activations
        for act in activations:
            lines.append(f"activate {act['participant']}")
            if act.get("deactivate"):
                lines.append(f"deactivate {act['participant']}")

    else:
        lines.append(f"note: Unsupported diagram type '{diagram_type}'")

    lines.append("@enduml")
    return "\n".join(lines)
