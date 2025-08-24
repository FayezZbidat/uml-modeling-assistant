from db import db
from datetime import datetime
import json

class Diagram(db.Model):
    __tablename__ = 'diagrams'

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    diagram_type = db.Column(db.String, nullable=False)
    plantuml_code = db.Column(db.Text, nullable=False)
    flow_data = db.Column(db.Text, nullable=True)   # stored as JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "diagram_type": self.diagram_type,
            "plantuml_code": self.plantuml_code,
            "flow_data": json.loads(self.flow_data) if self.flow_data else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ConversationSession(db.Model):
    __tablename__ = 'conversation_sessions'
    
    id = db.Column(db.String, primary_key=True)
    diagram_id = db.Column(db.String, db.ForeignKey('diagrams.id'))
    messages = db.Column(db.Text)  # Store as JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "diagram_id": self.diagram_id,
            "messages": json.loads(self.messages) if self.messages else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }