def generate_plantuml(model, diagram_type="class"):
    lines = ["@startuml"]

    if diagram_type == "class":
        for cls in model.get("classes", []):
            lines.append(f"class {cls['name']} {{")
            for attr in cls.get("attributes", []):
                lines.append(f"  +{attr}")
            lines.append("}")

        for rel in model.get("relationships", []):
            a, b, t = rel["from"], rel["to"], rel["type"]
            connector = {
                "one-to-many": '"1" --> "*"',
                "many-to-one": '"*" --> "1"',
                "many-to-many": '"*" --> "*"',
                "one-to-one": '"1" --> "1"'
            }.get(t, '"1" --> "1"')
            label = rel.get("label", "")
            lines.append(f"{a} {connector} {b} : {label}")

    elif diagram_type == "usecase":
        # 👥 Actors
        for actor in model.get("actors", []):
            lines.append(f"actor {actor}")

        # 🎯 Use Cases
        for uc in model.get("use_cases", []):
            lines.append(f'usecase "{uc}" as UC_{uc.replace(" ", "_")}')

        # 🔗 Associations
        for assoc in model.get("associations", []):
            actor = assoc.get("actor")
            use_case = assoc.get("use_case")
            uc_ref = f"UC_{use_case.replace(' ', '_')}"
            lines.append(f"{actor} --> {uc_ref}")

    elif diagram_type == "sequence":
        # 👤 Participants
        for p in model.get("participants", []):
            lines.append(f"participant {p}")

        # 📩 Messages
        for msg in model.get("messages", []):
            from_ = msg.get("from")
            to = msg.get("to")
            message = msg.get("message", "")
            lines.append(f"{from_} -> {to} : {message}")

    else:
        lines.append("' Unsupported diagram type")

    lines.append("@enduml")
    return "\n".join(lines)
