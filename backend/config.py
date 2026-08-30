import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"

for env_file in [
    BASE_DIR / ".env",
    BASE_DIR / ".env.local",
    BACKEND_DIR / ".env",
]:
    if env_file.exists():
        load_dotenv(env_file)


def get_env(key: str, default: str | None = None) -> str | None:
    return os.getenv(key, default)


SUPABASE_URL = get_env("SUPABASE_URL") or get_env("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = (
    get_env("SUPABASE_ANON_KEY") or get_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
SUPABASE_SERVICE_ROLE_KEY = get_env("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = (
    get_env("DATABASE_URL")
    or get_env("SUPABASE_DB_URL")
    or get_env("FLOWX_DB")
)

DB_PATH = get_env(
    "FLOWX_DB",
    str(BACKEND_DIR / "app" / "flowx.db"),
)
DB_MODE = (
    "postgres"
    if str(DATABASE_URL).startswith(
        ("postgres://", "postgresql://", "postgresql+psycopg://")
    )
    else "sqlite"
)

JWT_SECRET = get_env(
    "FLOWX_JWT_SECRET",
    "flowx-local-development-secret-change-me",
)
DEMO_MODE = get_env("DEMO_MODE", "true").lower() == "true"

CORS_ORIGINS = get_env("CORS_ORIGINS", "")
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
configured_origins = [
    origin.strip().rstrip("/")
    for origin in CORS_ORIGINS.split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_CORS_ORIGINS + configured_origins))
