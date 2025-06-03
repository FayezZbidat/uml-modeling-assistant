from flask import Flask
from routes.generate import generate_bp
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

app.register_blueprint(generate_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True)
print(app.url_map)
