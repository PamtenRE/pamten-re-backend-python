'''
# backend/app.py
from flask import Flask
from flask_cors import CORS
from .routes import api_bp # Import the blueprint

app = Flask(__name__)

# This allows your React app (e.g., from localhost:5173) to make requests to your Flask app (at localhost:5000)
CORS(app) 

# Register the blueprint
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
'''
'''
# backend/app.py
from flask import Flask
from flask_cors import CORS
from routes import api_bp

import os

app = Flask(__name__)

# This allows your React app to make requests to your Flask app
CORS(app)

# Register the blueprint
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
'''
from flask import Flask, request, jsonify
from flask_cors import CORS
from routes import api_bp
import os
import re
import google.generativeai as genai

app = Flask(__name__)

# ✅ Allow any Vercel deploy of your app + localhost (regex), and handle common preflight bits
CORS(
    app,
    resources={
        r"/api/*": {
            # Accept any https://<anything>.vercel.app plus your old hashed URL and localhost
            "origins": [
                re.compile(r"https://.*\.vercel\.app$"),
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Disposition"],
            "max_age": 86400,            # cache preflight for a day
            "supports_credentials": False
        }
    }
)

# Simple request logging
@app.before_request
def log_request_info():
    print(f"[REQUEST] {request.method} {request.path} from {request.remote_addr}")

# Health check (handy for quick tests)
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200

# Your API routes under /api
app.register_blueprint(api_bp, url_prefix="/api")

# Root route
@app.route("/")
def home():
    return {
        "status": "Backend running successfully!",
        "message": "RecruitEdge API is live 🚀"
    }, 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)



