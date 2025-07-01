from flask import Flask
from flask_cors import CORS
from db import db  # NEW: from db.py
from models import Diagram
from routes.generate import generate_bp
from routes.diagrams import diagrams_bp


app = Flask(__name__)
CORS(app)

# Database config
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///diagrams.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.register_blueprint(diagrams_bp, url_prefix='/api')
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

app.register_blueprint(generate_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True)
