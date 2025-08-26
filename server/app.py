from flask import Flask
from flask_cors import CORS
from db import db
from models import Diagram, ConversationSession
from routes.generate import generate_bp
from routes.diagrams import diagrams_bp

app = Flask(__name__)

# ✅ Enable CORS with credentials (cookies)
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"]
    }
})

# Database config
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///diagrams.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

# Register blueprints
app.register_blueprint(generate_bp, url_prefix='/api')
app.register_blueprint(diagrams_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True)
