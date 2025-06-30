import os
from dotenv import load_dotenv

# טוען את קובץ .env שנמצא בתיקייה הנוכחית
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

print("🔑 OPENAI_API_KEY =", os.getenv("OPENAI_API_KEY"))
