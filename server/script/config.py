import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

# =========================
# MongoDB
# =========================
DB_URI = os.getenv("MONGODB_URI")
DB_NAME = "ai_talent_finder"
COL_RESEARCHERS = "researchers"
COL_TOPICS = "topics"
COL_FIELDS = "fields"
COL_INSTITUTIONS = "institutions"
COL_COUNTRIES = "countries"

# =========================
# OpenAlex API
# =========================
OPENALEX_BASE = "https://api.openalex.org"
API_KEY = os.getenv("OPENALEX_API_KEY")

# Limits
PER_PAGE = 200
MAX_PER_TOPIC= 500
SESSION_LIMIT = 30000
MAX_AUTHORS = 60000
REQUEST_TIMEOUT = 30