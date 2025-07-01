from datetime import datetime
from db import db

class Diagram(db.Model):
    __tablename__ = 'diagrams'

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    diagram_type = db.Column(db.String(50), nullable=False)
    plantuml_code = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "diagram_type": self.diagram_type,
            "plantuml_code": self.plantuml_code,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
