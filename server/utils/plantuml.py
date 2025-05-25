def generate_plantuml(model):
    lines = ["@startuml"]

    for cls in model["classes"]:
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

    lines.append("@enduml")
    return "\n".join(lines)
