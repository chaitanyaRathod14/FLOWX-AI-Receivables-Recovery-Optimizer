from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
import csv
import hmac
import io
import json
import os
from pathlib import Path
import secrets
import sqlite3
from typing import Any

import jwt
import psycopg
from psycopg.rows import dict_row
from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Any, Union


# ============================================================
# ENVIRONMENT
# ============================================================

from backend.config import (
    ALLOWED_ORIGINS,
    CORS_ORIGINS,
    DATABASE_URL,
    DB_MODE,
    DB_PATH,
    DEMO_MODE,
    JWT_SECRET,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)

print("USING DATABASE MODE:", DB_MODE)
if DB_MODE == "postgres":
    print("SUPABASE URL:", SUPABASE_URL)
    print("DATABASE URL: configured")
else:
    print("USING DATABASE FILE:", os.path.abspath(DB_PATH))


# ============================================================
# DATABASE
# ============================================================

class DbConnection:
    def __init__(self, native_connection: Any):
        self._connection = native_connection

    def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None):
        if DB_MODE == "postgres":
            postgres_sql = query.replace("?", "%s")
            cursor = self._connection.cursor(row_factory=dict_row)
            cursor.execute(postgres_sql, params or ())
            return cursor

        return self._connection.execute(query, params or ())

    def executescript(self, script: str) -> None:
        if DB_MODE == "postgres":
            statements = [
                statement.strip()
                for statement in script.split(";")
                if statement.strip()
            ]
            for statement in statements:
                if statement.upper().startswith("BEGIN"):
                    continue
                if statement.upper().startswith("COMMIT"):
                    continue
                self._connection.execute(statement)
            return

        self._connection.executescript(script)


    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()

    def __getattr__(self, name: str) -> Any:
        return getattr(self._connection, name)


def db() -> Any:
    if DB_MODE == "postgres":
        print("Supabase/Postgres database connection configured.")
        connection = psycopg.connect(DATABASE_URL, autocommit=False)
        return DbConnection(connection)

    os.makedirs(
        os.path.dirname(os.path.abspath(DB_PATH)),
        exist_ok=True,
    )

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def last_insert_id(connection: Any) -> int:
    if DB_MODE == "postgres":
        row = connection.execute("SELECT LASTVAL() AS id").fetchone()
        if row is None or row.get("id") is None:
            raise RuntimeError("Unable to resolve the inserted row id for Postgres.")
        return int(row["id"])

    return connection.execute("SELECT last_insert_rowid()").fetchone()[0]


def insert_and_return_id(connection: Any, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> int:
    if DB_MODE == "postgres":
        postgres_query = query.strip()
        if postgres_query.endswith(";"):
            postgres_query = postgres_query[:-1]
        row = connection.execute(f"{postgres_query} RETURNING id", params or ()).fetchone()
        if row is None or row.get("id") is None:
            raise RuntimeError("Insert did not return a generated id for Postgres.")
        return int(row["id"])

    connection.execute(query, params or ())
    return last_insert_id(connection)


# ============================================================
# HELPERS
# ============================================================

def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(
    password: str,
    salt: bytes | None = None,
) -> str:

    salt = salt or secrets.token_bytes(16)

    digest = pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        120_000,
    )

    return f"{salt.hex()}${digest.hex()}"


def verify_password(
    password: str,
    stored: str,
) -> bool:

    try:
        salt, digest = stored.split("$")

        candidate = pbkdf2_hmac(
            "sha256",
            password.encode(),
            bytes.fromhex(salt),
            120_000,
        ).hex()

        return hmac.compare_digest(
            candidate,
            digest,
        )

    except (ValueError, TypeError):
        return False


# ============================================================
# JWT
# ============================================================

def token_for(user: dict[str, Any]) -> str:

    issued_at = datetime.now(timezone.utc)

    payload = {
        "sub": str(user["id"]),
        "merchant_id": int(user["merchant_id"]),
        "iat": issued_at,
        "exp": issued_at + timedelta(days=7),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256",
    )


# ============================================================
# AUDIT
# ============================================================

def audit(
    connection: Any,
    merchant_id: int,
    event_type: str,
    description: str,
    actor_id: int | None = None,
    action_id: int | None = None,
    details: dict[str, Any] | None = None,
) -> None:

    connection.execute(
        """
        INSERT INTO audit_logs
        (
            merchant_id,
            actor_id,
            action_id,
            event_type,
            description,
            details,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            merchant_id,
            actor_id,
            action_id,
            event_type,
            description,
            json.dumps(details or {}),
            now(),
        ),
    )


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db() -> None:

    connection = db()

    if DB_MODE == "postgres":
        schema_path = Path(__file__).resolve().parent / "supabase_schema.sql"
        schema_sql = schema_path.read_text(encoding="utf-8")
        connection.executescript(schema_sql)
    else:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS merchants (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL
                    REFERENCES merchants(id),
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS policies (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER UNIQUE NOT NULL
                    REFERENCES merchants(id),
                max_discount_percent REAL NOT NULL DEFAULT 5,
                approval_threshold_percent REAL NOT NULL DEFAULT 2,
                high_value_threshold REAL NOT NULL DEFAULT 10000,
                max_automated_reminders INTEGER NOT NULL DEFAULT 3,
                early_payment_discounts INTEGER NOT NULL DEFAULT 1,
                automated_reminders INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL
                    REFERENCES merchants(id),
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL
                    REFERENCES merchants(id),
                customer_id INTEGER NOT NULL
                    REFERENCES customers(id),
                invoice_number TEXT NOT NULL,
                issue_date TEXT NOT NULL,
                due_date TEXT NOT NULL,
                amount REAL NOT NULL,
                paid_amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                description TEXT NOT NULL,
                risk_probability REAL NOT NULL,
                risk_tier TEXT NOT NULL,
                predicted_delay_days INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recovery_actions (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL
                    REFERENCES merchants(id),
                invoice_id INTEGER NOT NULL
                    REFERENCES invoices(id),
                action_type TEXT NOT NULL,
                reason TEXT NOT NULL,
                discount_percent REAL NOT NULL DEFAULT 0,
                confidence REAL NOT NULL,
                policy_result TEXT NOT NULL,
                status TEXT NOT NULL,
                external_reference TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS promises (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL
                    REFERENCES merchants(id),
                invoice_id INTEGER NOT NULL
                    REFERENCES invoices(id),
                committed_amount REAL NOT NULL,
                promised_date TEXT NOT NULL,
                notes TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS webhook_events (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL,
                event_id TEXT UNIQUE NOT NULL,
                payload TEXT NOT NULL,
                processed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY,
                merchant_id INTEGER NOT NULL,
                actor_id INTEGER,
                action_id INTEGER,
                event_type TEXT NOT NULL,
                description TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

    if (
        DEMO_MODE
        and not connection.execute(
            "SELECT 1 FROM merchants LIMIT 1"
        ).fetchone()
    ):
        seed(
            connection,
            merchant_name="Acme Receivables",
            email="jordan@acmereceivables.com",
            full_name="Jordan Davis",
            password="demo1234",
        )

    connection.commit()
    connection.close()


# ============================================================
# DEMO SEED
# ============================================================

def seed(
    connection: Any,
    merchant_name: str,
    email: str,
    full_name: str,
    password: str,
    merchant_id: int | None = None,
    actor_id: int | None = None,
) -> tuple[int, int | None]:

    created = now()

    if merchant_id is None:

        connection.execute(
            """
            INSERT INTO merchants
            (name, created_at)
            VALUES (?, ?)
            """,
            (
                merchant_name,
                created,
            ),
        )

        merchant_id = last_insert_id(connection)

    if actor_id is None:

        existing = connection.execute(
            """
            SELECT id
            FROM users
            WHERE merchant_id=?
            ORDER BY id
            LIMIT 1
            """,
            (merchant_id,),
        ).fetchone()

        if existing:

            actor_id = existing[0]

        else:

            connection.execute(
                """
                INSERT INTO users
                (
                    merchant_id,
                    email,
                    full_name,
                    role,
                    password_hash
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    merchant_id,
                    email,
                    full_name,
                    "finance_admin",
                    hash_password(password),
                ),
            )

            actor_id = last_insert_id(connection)

    if not connection.execute(
        """
        SELECT 1
        FROM policies
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone():

        connection.execute(
            """
            INSERT INTO policies
            (merchant_id)
            VALUES (?)
            """,
            (merchant_id,),
        )

    customers = [
        (
            "Northstar Labs",
            "ap@northstar.example",
        ),
        (
            "Morrow & Co.",
            "finance@morrow.example",
        ),
        (
            "Pinecone Health",
            "billing@pinecone.example",
        ),
        (
            "Kite Systems",
            "payables@kite.example",
        ),
    ]

    for name, customer_email in customers:

        if not connection.execute(
            """
            SELECT 1
            FROM customers
            WHERE merchant_id=?
              AND name=?
            """,
            (
                merchant_id,
                name,
            ),
        ).fetchone():

            connection.execute(
                """
                INSERT INTO customers
                (
                    merchant_id,
                    name,
                    email
                )
                VALUES (?, ?, ?)
                """,
                (
                    merchant_id,
                    name,
                    customer_email,
                ),
            )

    customer_ids = [
        row["id"]
        for row in connection.execute(
            """
            SELECT id
            FROM customers
            WHERE merchant_id=?
            ORDER BY id
            """,
            (merchant_id,),
        ).fetchall()
    ]

    invoice_specs = [
        (
            "INV-2841",
            customer_ids[0],
            18420,
            48,
            "Critical",
            0.92,
            48,
        ),
        (
            "INV-2819",
            customer_ids[1],
            9800,
            22,
            "High",
            0.76,
            28,
        ),
        (
            "INV-2807",
            customer_ids[2],
            6240,
            11,
            "Medium",
            0.48,
            15,
        ),
        (
            "INV-2794",
            customer_ids[3],
            3900,
            5,
            "Low",
            0.18,
            7,
        ),
    ]

    for (
        number,
        customer_id,
        amount,
        overdue,
        tier,
        probability,
        delay,
    ) in invoice_specs:

        if connection.execute(
            """
            SELECT 1
            FROM invoices
            WHERE merchant_id=?
              AND invoice_number=?
            """,
            (
                merchant_id,
                number,
            ),
        ).fetchone():

            continue

        due = date.today() - timedelta(
            days=overdue
        )

        connection.execute(
            """
            INSERT INTO invoices
            (
                merchant_id,
                customer_id,
                invoice_number,
                issue_date,
                due_date,
                amount,
                status,
                description,
                risk_probability,
                risk_tier,
                predicted_delay_days
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                merchant_id,
                customer_id,
                number,
                str(due - timedelta(days=30)),
                str(due),
                amount,
                "overdue",
                "Outstanding receivable",
                probability,
                tier,
                delay,
            ),
        )

        invoice_id = last_insert_id(connection)

        action_data = {
            "Critical": (
                "legal_escalation",
                "Critical risk and aging exposure",
                0,
                0.94,
                "PENDING_APPROVAL",
            ),
            "High": (
                "early_payment_discount",
                "High probability of delayed payment",
                2,
                0.81,
                "RECOMMENDED",
            ),
            "Medium": (
                "promise_to_pay",
                "Medium risk requires commitment",
                0,
                0.72,
                "RECOMMENDED",
            ),
            "Low": (
                "payment_link_reminder",
                "Low-risk automated reminder",
                0,
                0.89,
                "EXECUTED",
            ),
        }[tier]

        connection.execute(
            """
            INSERT INTO recovery_actions
            (
                merchant_id,
                invoice_id,
                action_type,
                reason,
                discount_percent,
                confidence,
                policy_result,
                status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'PASS', ?, ?, ?)
            """,
            (
                merchant_id,
                invoice_id,
                *action_data,
                created,
                created,
            ),
        )

    audit(
        connection,
        merchant_id,
        "SYSTEM_SEEDED",
        "Demo receivables dataset initialized",
        actor_id,
        details={"demo": True},
    )

    return merchant_id, actor_id


# ============================================================
# APP
# ============================================================

@asynccontextmanager
async def lifespan(_: FastAPI):

    yield


app = FastAPI(
    title="FLOWX API",
    version="1.1.0",
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://flowx-ai-receivables-recovery-optim.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT / HEALTH
# ============================================================

@app.get("/")
def root() -> dict[str, Any]:

    return {
        "status": "online",
        "service": "FLOWX AI Receivables Recovery Optimizer API",
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict[str, Any]:

    return {
        "status": "ok",
        "service": "flowx-api",
        "components": [
            {
                "name": "Risk & recovery engine",
                "status": "operational",
                "latency_ms": 18,
            },
            {
                "name": "Policy engine",
                "status": "operational",
                "latency_ms": 7,
            },
            {
                "name": "Receivables database",
                "status": "operational",
                "latency_ms": 4,
            },
            {
                "name": "Demo workflow",
                "status": "operational",
                "latency_ms": 11,
            },
        ],
    }


# ============================================================
# MODELS
# ============================================================

class AuthInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RegisterInput(AuthInput):
    full_name: str = Field(min_length=2)
    merchant_name: str = Field(min_length=2)


class PolicyInput(BaseModel):
    max_discount_percent: float = Field(
        ge=0,
        le=100,
    )

    approval_threshold_percent: float = Field(
        ge=0,
        le=100,
    )

    high_value_threshold: float = Field(
        ge=0
    )

    max_automated_reminders: int = Field(
        ge=0,
        le=20,
    )

    early_payment_discounts: bool
    automated_reminders: bool


class InvoiceInput(BaseModel):
    invoice_number: str = Field(
        min_length=1,
        max_length=80,
    )

    customer_name: str = Field(
        min_length=2,
        max_length=150,
    )

    customer_email: EmailStr

    issue_date: date
    due_date: date

    amount: float = Field(gt=0)

    paid_amount: float = Field(
        ge=0,
        default=0,
    )

    description: str = "Receivable"


class PromiseInput(BaseModel):
    invoice_id: int

    committed_amount: float = Field(
        gt=0
    )

    promised_date: date

    notes: str = ""


class WebhookInput(BaseModel):
    event_id: str

    invoice_id: int

    amount: float = Field(gt=0)

    promise_id: int | None = None


class UserOut(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    email: str
    full_name: str
    role: str
    merchant_id: int
    merchant_name: str


# ============================================================
# AUTHENTICATION
# ============================================================

def current_user(
    authorization: str | None = Header(
        default=None
    ),
) -> dict[str, Any]:

    if not authorization:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if not authorization.startswith(
        "Bearer "
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    token = authorization[
        7:
    ].strip()

    if not token:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
        )

    except jwt.ExpiredSignatureError as error:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        ) from error

    except jwt.InvalidTokenError as error:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from error

    user_id = payload.get("sub")
    merchant_id = payload.get(
        "merchant_id"
    )

    if not user_id or not merchant_id:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication payload",
        )

    connection = db()

    try:

        user = connection.execute(
            """
            SELECT
                u.*,
                m.name AS merchant_name
            FROM users u
                JOIN merchants m
                    ON m.id = u.merchant_id
            WHERE u.id = ?
              AND u.merchant_id = ?
              AND u.active = TRUE
            """,
            (
                int(user_id),
                int(merchant_id),
            ),
        ).fetchone()

    finally:

        connection.close()

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists",
        )

    return user


def user_json(
    user: dict[str, Any],
) -> dict[str, Any]:

    return {
        key: user[key]
        for key in (
            "id",
            "email",
            "full_name",
            "role",
            "merchant_id",
            "merchant_name",
        )
    }


# ============================================================
# RISK ENGINE
# ============================================================

def risk_for_invoice(
    amount: float,
    due_date: date,
    paid_amount: float,
) -> tuple[str, float, int]:

    overdue = max(
        0,
        (date.today() - due_date).days,
    )

    outstanding = max(
        0,
        amount - paid_amount,
    )

    if outstanding <= 0:

        return "Low", 0.05, 0

    if (
        overdue >= 45
        or (
            overdue >= 30
            and amount >= 10000
        )
    ):

        return (
            "Critical",
            0.92,
            overdue + 12,
        )

    if (
        overdue >= 15
        or amount >= 50000
    ):

        return (
            "High",
            0.72,
            overdue + 8,
        )

    if overdue > 0:

        return (
            "Medium",
            0.45,
            overdue + 4,
        )

    return "Low", 0.15, 5


# ============================================================
# CREATE INVOICE
# ============================================================

def create_invoice(
    connection: Any,
    merchant_id: int,
    data: InvoiceInput,
    actor_id: int,
    audit_event: str = "INVOICE_CREATED",
) -> dict[str, Any]:

    if connection.execute(
        """
        SELECT 1
        FROM invoices
        WHERE merchant_id=?
          AND invoice_number=?
        """,
        (
            merchant_id,
            data.invoice_number,
        ),
    ).fetchone():

        raise HTTPException(
            409,
            "Invoice number already exists",
        )

    if data.paid_amount > data.amount:

        raise HTTPException(
            400,
            "Paid amount cannot exceed invoice amount",
        )

    customer = connection.execute(
        """
        SELECT *
        FROM customers
        WHERE merchant_id=?
          AND lower(name)=lower(?)
        """,
        (
            merchant_id,
            data.customer_name,
        ),
    ).fetchone()

    if customer:

        customer_id = customer["id"]

        connection.execute(
            """
            UPDATE customers
            SET email=?
            WHERE id=?
            """,
            (
                str(data.customer_email),
                customer_id,
            ),
        )

    else:

        connection.execute(
            """
            INSERT INTO customers
            (
                merchant_id,
                name,
                email
            )
            VALUES (?, ?, ?)
            """,
            (
                merchant_id,
                data.customer_name,
                str(data.customer_email),
            ),
        )

        customer_id = last_insert_id(connection)

    tier, probability, delay = risk_for_invoice(
        data.amount,
        data.due_date,
        data.paid_amount,
    )

    if data.paid_amount >= data.amount:

        invoice_status = "paid"

    elif data.paid_amount > 0:

        invoice_status = "partially_paid"

    elif data.due_date < date.today():

        invoice_status = "overdue"

    else:

        invoice_status = "open"

    connection.execute(
        """
        INSERT INTO invoices
        (
            merchant_id,
            customer_id,
            invoice_number,
            issue_date,
            due_date,
            amount,
            paid_amount,
            status,
            description,
            risk_probability,
            risk_tier,
            predicted_delay_days
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            merchant_id,
            customer_id,
            data.invoice_number,
            str(data.issue_date),
            str(data.due_date),
            data.amount,
            data.paid_amount,
            invoice_status,
            data.description,
            probability,
            tier,
            delay,
        ),
    )

    invoice_id = last_insert_id(connection)

    action_type, reason, discount, confidence, action_status = {
        "Critical": (
            "legal_escalation",
            "Critical risk requires controlled escalation",
            0,
            0.91,
            "PENDING_APPROVAL",
        ),
        "High": (
            "early_payment_discount",
            "High-risk invoice needs accelerated recovery",
            2,
            0.82,
            "RECOMMENDED",
        ),
        "Medium": (
            "promise_to_pay",
            "Commitment-based recovery is recommended",
            0,
            0.76,
            "RECOMMENDED",
        ),
        "Low": (
            "payment_link_reminder",
            "Low-risk invoice can use a lightweight reminder",
            0,
            0.88,
            "RECOMMENDED",
        ),
    }[tier]

    policy = connection.execute(
        """
        SELECT *
        FROM policies
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone()

    policy_result = (
        "PASS"
        if discount <= policy["max_discount_percent"]
        else "BLOCK"
    )

    if (
        tier == "Critical"
        and data.amount >= policy["high_value_threshold"]
    ):

        action_status = "PENDING_APPROVAL"

    connection.execute(
        """
        INSERT INTO recovery_actions
        (
            merchant_id,
            invoice_id,
            action_type,
            reason,
            discount_percent,
            confidence,
            policy_result,
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            merchant_id,
            invoice_id,
            action_type,
            reason,
            discount,
            confidence,
            policy_result,
            action_status,
            now(),
            now(),
        ),
    )

    action_id = last_insert_id(connection)

    audit(
        connection,
        merchant_id,
        audit_event,
        f"Invoice {data.invoice_number} created with {tier} risk",
        actor_id,
        action_id,
        {
            "invoice_id": invoice_id,
            "risk_tier": tier,
        },
    )

    return dict(
        connection.execute(
            """
            SELECT
                i.*,
                c.name AS customer_name
            FROM invoices i
            JOIN customers c
                ON c.id = i.customer_id
            WHERE i.id=?
            """,
            (invoice_id,),
        ).fetchone()
    )


# ============================================================
# REGISTER
# ============================================================

@app.post("/auth/register")
def register(
    data: RegisterInput,
) -> dict[str, Any]:

    connection = db()

    try:

        email = str(
            data.email
        ).strip().lower()

        full_name = data.full_name.strip()
        merchant_name = data.merchant_name.strip()

        existing = connection.execute(
            """
            SELECT 1
            FROM users
            WHERE lower(email)=lower(?)
            """,
            (email,),
        ).fetchone()

        if existing:

            raise HTTPException(
                400,
                "An account with this email already exists",
            )

        connection.execute(
            """
            INSERT INTO merchants
            (
                name,
                created_at
            )
            VALUES (?, ?)
            """,
            (
                merchant_name,
                now(),
            ),
        )

        merchant_id = last_insert_id(connection)

        connection.execute(
            """
            INSERT INTO users
            (
                merchant_id,
                email,
                full_name,
                role,
                password_hash
            )
            VALUES (?, ?, ?, 'finance_admin', ?)
            """,
            (
                merchant_id,
                email,
                full_name,
                hash_password(data.password),
            ),
        )

        user_id = last_insert_id(connection)

        connection.execute(
            """
            INSERT INTO policies
            (merchant_id)
            VALUES (?)
            """,
            (merchant_id,),
        )

        audit(
            connection,
            merchant_id,
            "WORKSPACE_CREATED",
            "New merchant workspace created",
            user_id,
        )

        connection.commit()

        user = connection.execute(
            """
            SELECT
                u.*,
                m.name AS merchant_name
            FROM users u
            JOIN merchants m
                ON m.id = u.merchant_id
            WHERE u.id=?
            """,
            (user_id,),
        ).fetchone()

        return {
            "access_token": token_for(user),
            "token_type": "bearer",
            "user": user_json(user),
        }

    except HTTPException:

        connection.rollback()
        raise

    except Exception:

        connection.rollback()
        raise

    finally:

        connection.close()


# ============================================================
# LOGIN
# ============================================================

@app.post("/auth/login")
def login(
    data: AuthInput,
) -> dict[str, Any]:

    connection = db()

    try:

        email = str(
            data.email
        ).strip().lower()

        user = connection.execute(
            """
            SELECT
                u.*,
                m.name AS merchant_name
            FROM users u
            JOIN merchants m
                ON m.id = u.merchant_id
            WHERE lower(u.email)=lower(?)
            """,
            (email,),
        ).fetchone()

    finally:

        connection.close()

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user["active"]:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account is inactive",
        )

    if not verify_password(
        data.password,
        user["password_hash"],
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return {
        "access_token": token_for(user),
        "token_type": "bearer",
        "user": user_json(user),
    }


# ============================================================
# AUTH ME
# ============================================================

@app.get("/auth/me")
def me(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    return user_json(user)


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/dashboard")
def dashboard(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    merchant_id = user["merchant_id"]

    total = connection.execute(
        """
        SELECT
            COALESCE(
                SUM(amount-paid_amount),
                0
            ) AS value
        FROM invoices
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone()["value"]

    recovered = connection.execute(
        """
        SELECT
            COALESCE(
                SUM(paid_amount),
                0
            ) AS value
        FROM invoices
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone()["value"]

    at_risk = connection.execute(
        """
        SELECT
            COALESCE(
                SUM(amount-paid_amount),
                0
            ) AS value
        FROM invoices
        WHERE merchant_id=?
          AND risk_tier IN ('Critical','High')
        """,
        (merchant_id,),
    ).fetchone()["value"]

    promise_total = connection.execute(
        """
        SELECT COUNT(*) c
        FROM promises
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone()["c"]

    promise_kept = connection.execute(
        """
        SELECT COUNT(*) c
        FROM promises
        WHERE merchant_id=?
          AND status IN ('KEPT','PAID')
        """,
        (merchant_id,),
    ).fetchone()["c"]

    actions = connection.execute(
        """
        SELECT
            a.*,
            i.invoice_number,
            c.name AS customer_name,
            i.amount AS invoice_amount,
            i.due_date,
            i.risk_tier
        FROM recovery_actions a
        JOIN invoices i
            ON i.id = a.invoice_id
        JOIN customers c
            ON c.id = i.customer_id
        WHERE a.merchant_id=?
        ORDER BY a.id DESC
        """,
        (merchant_id,),
    ).fetchall()

    risk = [
        dict(row)
        for row in connection.execute(
            """
            SELECT
                risk_tier,
                COALESCE(
                    SUM(amount-paid_amount),
                    0
                ) AS exposure,
                COUNT(*) AS count
            FROM invoices
            WHERE merchant_id=?
            GROUP BY risk_tier
            """,
            (merchant_id,),
        ).fetchall()
    ]

    policy = connection.execute(
        """
        SELECT *
        FROM policies
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone()

    connection.close()

    trend = [
        {
            "month": month,
            "flowx": round(
                recovered * factor
            ),
            "baseline": round(
                recovered * factor * 0.72
            ),
        }
        for month, factor in zip(
            (
                "Sep",
                "Oct",
                "Nov",
                "Dec",
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
            ),
            (
                0.18,
                0.24,
                0.31,
                0.37,
                0.43,
                0.51,
                0.58,
                0.66,
                0.73,
                0.81,
                0.90,
                1.00,
            ),
        )
    ]

    return {
        "metrics": {
            "total_receivables": total,
            "cash_recovered": recovered,
            "at_risk": at_risk,
            "promise_kept_rate": (
                round(
                    promise_kept
                    / promise_total
                    * 100,
                    1,
                )
                if promise_total
                else 0
            ),
        },
        "actions": [
            dict(row)
            for row in actions
        ],
        "risk_distribution": risk,
        "recovery_trend": trend,
        "policy": dict(policy),
        "synced_at": now(),
    }


# ============================================================
# INVOICES
# ============================================================

@app.get("/invoices")
def invoices(
    user: dict[str, Any] = Depends(
        current_user
    ),
    risk: str | None = Query(
        default=None
    ),
) -> list[dict[str, Any]]:

    connection = db()

    sql = """
        SELECT
            i.*,
            c.name AS customer_name,
            c.email AS customer_email
        FROM invoices i
        JOIN customers c
            ON c.id=i.customer_id
        WHERE i.merchant_id=?
    """

    params: list[Any] = [
        user["merchant_id"]
    ]

    if risk:

        sql += """
            AND i.risk_tier=?
        """

        params.append(risk)

    sql += """
        ORDER BY i.due_date DESC
    """

    rows = [
        dict(row)
        for row in connection.execute(
            sql,
            params,
        ).fetchall()
    ]

    connection.close()

    return rows


# ============================================================
# INVOICE DECISION / AI RECOVERY SIMULATOR
# ============================================================

@app.get("/invoices/{invoice_id}/decision")
def invoice_decision(
    invoice_id: int,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    merchant_id = user["merchant_id"]

    invoice = connection.execute(
        """
        SELECT
            i.*,
            c.name AS customer_name,
            c.email AS customer_email
        FROM invoices i
        JOIN customers c
            ON c.id=i.customer_id
        WHERE i.id=?
          AND i.merchant_id=?
        """,
        (
            invoice_id,
            merchant_id,
        ),
    ).fetchone()

    if not invoice:

        connection.close()

        raise HTTPException(
            404,
            "Invoice not found",
        )

    customer_invoices = connection.execute(
        """
        SELECT *
        FROM invoices
        WHERE merchant_id=?
          AND customer_id=?
        """,
        (
            merchant_id,
            invoice["customer_id"],
        ),
    ).fetchall()

    policy = connection.execute(
        """
        SELECT *
        FROM policies
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchone()

    connection.close()

    outstanding = max(
        0,
        float(invoice["amount"])
        - float(invoice["paid_amount"]),
    )

    due = date.fromisoformat(
        invoice["due_date"][:10]
    )

    overdue_days = max(
        0,
        (date.today() - due).days,
    )

    risk_probability = float(
        invoice["risk_probability"]
    )

    risk_tier = invoice["risk_tier"]

    # ---------------------------------------------------------
    # CUSTOMER BEHAVIOR
    # ---------------------------------------------------------

    late_invoices = 0
    total_delay = 0

    for item in customer_invoices:

        item_due = date.fromisoformat(
            item["due_date"][:10]
        )

        if item["status"] not in (
            "paid",
            "partially_paid",
        ):

            delay = max(
                0,
                (
                    date.today()
                    - item_due
                ).days,
            )

        else:

            delay = 0

        if delay > 0:

            late_invoices += 1
            total_delay += delay

    customer_invoice_count = len(
        customer_invoices
    )

    average_delay = (
        round(
            total_delay
            / late_invoices,
            1,
        )
        if late_invoices
        else 0
    )

    late_payment_rate = (
        round(
            late_invoices
            / customer_invoice_count
            * 100,
            1,
        )
        if customer_invoice_count
        else 0
    )

    # ---------------------------------------------------------
    # EXPLAINABLE RISK
    # ---------------------------------------------------------

    risk_drivers: list[
        dict[str, Any]
    ] = []

    if overdue_days > 0:

        risk_drivers.append(
            {
                "factor": "Invoice aging",
                "value": f"{overdue_days} days overdue",
                "impact": (
                    "HIGH"
                    if overdue_days >= 30
                    else "MEDIUM"
                ),
                "explanation":
                    f"The invoice has remained unpaid for "
                    f"{overdue_days} days after its due date.",
            }
        )

    if risk_probability >= 0.75:

        risk_drivers.append(
            {
                "factor":
                    "Payment delay probability",
                "value":
                    f"{round(risk_probability * 100)}%",
                "impact": "HIGH",
                "explanation":
                    "Historical and invoice-level signals "
                    "indicate a high probability of delayed payment.",
            }
        )

    elif risk_probability >= 0.45:

        risk_drivers.append(
            {
                "factor":
                    "Payment delay probability",
                "value":
                    f"{round(risk_probability * 100)}%",
                "impact": "MEDIUM",
                "explanation":
                    "The invoice shows a meaningful "
                    "probability of payment delay.",
            }
        )

    if (
        invoice["amount"]
        >= float(
            policy["high_value_threshold"]
        )
    ):

        risk_drivers.append(
            {
                "factor":
                    "High-value exposure",
                "value":
                    f"₹{round(invoice['amount']):,}",
                "impact": "HIGH",
                "explanation":
                    "The invoice exceeds the merchant's "
                    "configured high-value threshold.",
            }
        )

    if late_payment_rate >= 50:

        risk_drivers.append(
            {
                "factor":
                    "Customer payment behaviour",
                "value":
                    f"{late_payment_rate}% late",
                "impact": "HIGH",
                "explanation":
                    f"This customer has historically paid late "
                    f"on {late_payment_rate}% of invoices.",
            }
        )

    if average_delay > 0:

        risk_drivers.append(
            {
                "factor":
                    "Average payment delay",
                "value":
                    f"{average_delay} days",
                "impact": "MEDIUM",
                "explanation":
                    "The customer's previous invoices indicate "
                    "a recurring payment delay pattern.",
            }
        )

    # ---------------------------------------------------------
    # RECOVERY STRATEGIES
    # ---------------------------------------------------------

    strategies: list[
        dict[str, Any]
    ] = []

    reminder_recovery_rate = {
        "Critical": 0.55,
        "High": 0.62,
        "Medium": 0.72,
        "Low": 0.82,
    }.get(
        risk_tier,
        0.65,
    )

    strategies.append(
        {
            "name":
                "Payment link reminder",
            "type":
                "REMINDER",
            "expected_recovery":
                round(
                    outstanding
                    * reminder_recovery_rate
                ),
            "expected_days":
                5
                if overdue_days > 0
                else 8,
            "confidence":
                82,
            "available":
                bool(
                    policy[
                        "automated_reminders"
                    ]
                ),
            "reason":
                "Low-friction recovery approach suitable "
                "for customers that may respond to a reminder.",
        }
    )

    promise_rate = {
        "Critical": 0.70,
        "High": 0.80,
        "Medium": 0.84,
        "Low": 0.76,
    }.get(
        risk_tier,
        0.75,
    )

    strategies.append(
        {
            "name":
                "Promise-to-pay",
            "type":
                "PROMISE",
            "expected_recovery":
                round(
                    outstanding
                    * promise_rate
                ),
            "expected_days":
                10,
            "confidence":
                86,
            "available":
                True,
            "reason":
                "Creates a customer commitment and gives FLOWX "
                "a measurable recovery milestone.",
        }
    )

    discount = min(
        float(
            policy[
                "max_discount_percent"
            ]
        ),
        1.0,
    )

    discount_available = bool(
        policy[
            "early_payment_discounts"
        ]
        and discount > 0
    )

    discount_recovery = round(
        outstanding * 0.90
    )

    discount_cost = round(
        outstanding
        * discount
        / 100
    )

    strategies.append(
        {
            "name":
                f"{discount:g}% early-payment discount",
            "type":
                "DISCOUNT",
            "expected_recovery":
                discount_recovery,
            "expected_days":
                7,
            "confidence":
                89,
            "available":
                discount_available,
            "discount_percent":
                discount,
            "discount_cost":
                discount_cost,
            "reason":
                "Trades a controlled amount of margin "
                "for faster cash conversion.",
        }
    )

    escalation_recovery_rate = (
        0.93
        if risk_tier == "Critical"
        else 0.84
        if risk_tier == "High"
        else 0.70
    )

    strategies.append(
        {
            "name":
                "Escalation + commitment",
            "type":
                "ESCALATION",
            "expected_recovery":
                round(
                    outstanding
                    * escalation_recovery_rate
                ),
            "expected_days":
                7,
            "confidence":
                91,
            "available":
                True,
            "requires_approval":
                True,
            "reason":
                "Higher-pressure recovery path for materially "
                "risky receivables.",
        }
    )

    available_strategies = [
        strategy
        for strategy in strategies
        if strategy.get(
            "available",
            True,
        )
    ]

    recommended = max(
        available_strategies,
        key=lambda item: (
            item["expected_recovery"]
            / max(
                item["expected_days"],
                1,
            )
        ),
    )

    # ---------------------------------------------------------
    # CASH IMPACT
    # ---------------------------------------------------------

    do_nothing_recovery = round(
        outstanding
        * max(
            0.15,
            1 - risk_probability,
        )
    )

    recommended_recovery = int(
        recommended[
            "expected_recovery"
        ]
    )

    cash_acceleration = max(
        0,
        recommended_recovery
        - do_nothing_recovery,
    )

    estimated_days_saved = max(
        0,
        int(
            max(
                0,
                invoice[
                    "predicted_delay_days"
                ],
            )
            - recommended[
                "expected_days"
            ]
        ),
    )

    # ---------------------------------------------------------
    # CASH FORECAST
    # ---------------------------------------------------------

    forecast = {
        "7_days": round(
            outstanding
            * min(
                1,
                recommended_recovery
                / max(
                    outstanding,
                    1,
                ),
            )
        ),

        "14_days": round(
            outstanding
            * min(
                1,
                (
                    recommended_recovery
                    / max(
                        outstanding,
                        1,
                    )
                )
                + 0.06,
            )
        ),

        "30_days": round(
            outstanding
            * min(
                1,
                (
                    recommended_recovery
                    / max(
                        outstanding,
                        1,
                    )
                )
                + 0.10,
            )
        ),
    }

    recommendation_reason = (
        f"FLOWX recommends "
        f"{recommended['name']} because "
        f"it provides an estimated "
        f"₹{recommended_recovery:,} recovery "
        f"within approximately "
        f"{recommended['expected_days']} days."
    )

    # ---------------------------------------------------------
    # AUDIT
    # ---------------------------------------------------------

    connection = db()

    audit(
        connection,
        merchant_id,
        "AI_DECISION_ANALYSIS",
        f"FLOWX analyzed invoice "
        f"{invoice['invoice_number']}",
        user["id"],
        details={
            "invoice_id":
                invoice_id,
            "risk_tier":
                risk_tier,
            "recommended_strategy":
                recommended["name"],
            "cash_acceleration":
                cash_acceleration,
        },
    )

    connection.commit()
    connection.close()

    return {
        "invoice": {
            "id":
                invoice["id"],
            "invoice_number":
                invoice["invoice_number"],
            "customer_name":
                invoice["customer_name"],
            "amount":
                invoice["amount"],
            "paid_amount":
                invoice["paid_amount"],
            "outstanding":
                outstanding,
            "due_date":
                invoice["due_date"],
            "overdue_days":
                overdue_days,
            "status":
                invoice["status"],
        },

        "risk": {
            "tier":
                risk_tier,
            "probability":
                round(
                    risk_probability
                    * 100
                ),
            "predicted_delay_days":
                invoice[
                    "predicted_delay_days"
                ],
        },

        "risk_drivers":
            risk_drivers,

        "customer_behavior": {
            "invoice_count":
                customer_invoice_count,
            "late_payment_rate":
                late_payment_rate,
            "average_delay_days":
                average_delay,
        },

        "strategies":
            strategies,

        "recommended_strategy":
            recommended,

        "cash_impact": {
            "outstanding":
                outstanding,
            "do_nothing_expected_recovery":
                do_nothing_recovery,
            "recommended_expected_recovery":
                recommended_recovery,
            "cash_acceleration":
                cash_acceleration,
            "estimated_days_saved":
                estimated_days_saved,
        },

        "forecast":
            forecast,

        "recommendation_reason":
            recommendation_reason,

        "policy": {
            "max_discount_percent":
                policy[
                    "max_discount_percent"
                ],
            "approval_threshold_percent":
                policy[
                    "approval_threshold_percent"
                ],
            "high_value_threshold":
                policy[
                    "high_value_threshold"
                ],
        },
    }


# ============================================================
# ADD INVOICE
# ============================================================

@app.post("/invoices")
def add_invoice(
    data: InvoiceInput,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    try:

        row = create_invoice(
            connection,
            user["merchant_id"],
            data,
            user["id"],
        )

        connection.commit()

        return row

    finally:

        connection.close()


# ============================================================
# CSV IMPORT
# ============================================================

@app.post("/invoices/import")
async def import_invoices(
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    if (
        not file.filename
        or not file.filename.lower().endswith(
            ".csv"
        )
    ):

        raise HTTPException(
            400,
            "Please upload a CSV file",
        )

    raw = await file.read()

    try:

        text = raw.decode(
            "utf-8-sig"
        )

        reader = csv.DictReader(
            io.StringIO(text)
        )

    except Exception as exc:

        raise HTTPException(
            400,
            "Could not read the CSV file",
        ) from exc

    required = {
        "invoice_number",
        "customer_name",
        "customer_email",
        "issue_date",
        "due_date",
        "amount",
    }

    headers = {
        h.strip()
        for h in (
            reader.fieldnames or []
        )
        if h
    }

    if not required.issubset(
        headers
    ):

        raise HTTPException(
            400,
            "CSV must contain: "
            "invoice_number, customer_name, "
            "customer_email, issue_date, "
            "due_date, amount",
        )

    connection = db()

    created_count = 0
    skipped: list[str] = []

    try:

        for row in reader:

            try:

                payload = InvoiceInput(
                    invoice_number=row.get(
                        "invoice_number",
                        "",
                    ).strip(),

                    customer_name=row.get(
                        "customer_name",
                        "",
                    ).strip(),

                    customer_email=row.get(
                        "customer_email",
                        "",
                    ).strip(),

                    issue_date=date.fromisoformat(
                        row.get(
                            "issue_date",
                            "",
                        ).strip()
                    ),

                    due_date=date.fromisoformat(
                        row.get(
                            "due_date",
                            "",
                        ).strip()
                    ),

                    amount=float(
                        row.get(
                            "amount",
                            "0",
                        )
                    ),

                    paid_amount=float(
                        row.get(
                            "paid_amount",
                            "0",
                        )
                        or 0
                    ),

                    description=(
                        row.get(
                            "description",
                            "Receivable",
                        )
                        or "Receivable"
                    ),
                )

                create_invoice(
                    connection,
                    user["merchant_id"],
                    payload,
                    user["id"],
                    "INVOICE_IMPORTED",
                )

                created_count += 1

            except (
                ValueError,
                TypeError,
                HTTPException,
            ) as exc:

                number = row.get(
                    "invoice_number",
                    "unknown",
                )

                skipped.append(
                    f"{number}: "
                     f"{exc.detail if isinstance(exc, HTTPException) else 'invalid row'}"
                )

        audit(
            connection,
            user["merchant_id"],
            "INVOICE_IMPORT",
            f"Imported {created_count} invoice(s)",
            user["id"],
            details={
                "created":
                    created_count,
                "skipped":
                    skipped,
            },
        )

        connection.commit()

        return {
            "created":
                created_count,
            "skipped":
                skipped,
        }

    finally:

        connection.close()


# ============================================================
# RECOVERY APPROVAL
# ============================================================

@app.post("/recovery/{action_id}/approve")
def approve(
    action_id: int,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    action = connection.execute(
        """
        SELECT *
        FROM recovery_actions
        WHERE id=?
          AND merchant_id=?
        """,
        (
            action_id,
            user["merchant_id"],
        ),
    ).fetchone()

    if not action:

        connection.close()

        raise HTTPException(
            404,
            "Recovery action not found",
        )

    if action["policy_result"] != "PASS":

        connection.close()

        raise HTTPException(
            403,
            "Blocked by merchant policy",
        )

    connection.execute(
        """
        UPDATE recovery_actions
        SET
            status='APPROVED',
            updated_at=?
        WHERE id=?
        """,
        (
            now(),
            action_id,
        ),
    )

    audit(
        connection,
        user["merchant_id"],
        "ACTION_APPROVED",
        f"Recovery action {action_id} approved",
        user["id"],
        action_id,
    )

    connection.commit()

    updated = connection.execute(
        """
        SELECT *
        FROM recovery_actions
        WHERE id=?
        """,
        (action_id,),
    ).fetchone()

    connection.close()

    return dict(updated)


# ============================================================
# RECOVERY EXECUTION
# ============================================================

@app.post("/recovery/{action_id}/execute")
def execute(
    action_id: int,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    action = connection.execute(
        """
        SELECT *
        FROM recovery_actions
        WHERE id=?
          AND merchant_id=?
        """,
        (
            action_id,
            user["merchant_id"],
        ),
    ).fetchone()

    if not action:

        connection.close()

        raise HTTPException(
            404,
            "Recovery action not found",
        )

    if action["status"] not in (
        "APPROVED",
        "RECOMMENDED",
        "EXECUTED",
    ):

        connection.close()

        raise HTTPException(
            409,
            "Action must be approved or recommended before execution",
        )

    reference = (
        action["external_reference"]
        or f"flowx_mock_{secrets.token_hex(8)}"
    )

    connection.execute(
        """
        UPDATE recovery_actions
        SET
            status='EXECUTED',
            external_reference=?,
            updated_at=?
        WHERE id=?
        """,
        (
            reference,
            now(),
            action_id,
        ),
    )

    audit(
        connection,
        user["merchant_id"],
        "ACTION_EXECUTED",
        f"Payment workflow executed for action {action_id}",
        user["id"],
        action_id,
        {
            "reference":
                reference
        },
    )

    connection.commit()

    updated = connection.execute(
        """
        SELECT *
        FROM recovery_actions
        WHERE id=?
        """,
        (action_id,),
    ).fetchone()

    connection.close()

    return dict(updated)


# ============================================================
# POLICIES
# ============================================================

@app.get("/policies")
def get_policy(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    policy = connection.execute(
        """
        SELECT *
        FROM policies
        WHERE merchant_id=?
        """,
        (user["merchant_id"],),
    ).fetchone()

    connection.close()

    if not policy:

        raise HTTPException(
            404,
            "Policy configuration not found",
        )

    return dict(policy)


@app.put("/policies")
def update_policy(
    data: PolicyInput,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    values = data.model_dump()

    connection.execute(
        """
        UPDATE policies
        SET
            max_discount_percent=?,
            approval_threshold_percent=?,
            high_value_threshold=?,
            max_automated_reminders=?,
            early_payment_discounts=?,
            automated_reminders=?
        WHERE merchant_id=?
        """,
        (
            values[
                "max_discount_percent"
            ],
            values[
                "approval_threshold_percent"
            ],
            values[
                "high_value_threshold"
            ],
            values[
                "max_automated_reminders"
            ],
            values[
                "early_payment_discounts"
            ],
            values[
                "automated_reminders"
            ],
            user["merchant_id"],
        ),
    )

    audit(
        connection,
        user["merchant_id"],
        "POLICY_UPDATED",
        "Merchant financial guardrails updated",
        user["id"],
        details=values,
    )

    connection.commit()

    policy = connection.execute(
        """
        SELECT *
        FROM policies
        WHERE merchant_id=?
        """,
        (user["merchant_id"],),
    ).fetchone()

    connection.close()

    return dict(policy)


# ============================================================
# PROMISES
# ============================================================

@app.get("/promises")
def promises(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> list[dict[str, Any]]:

    connection = db()

    rows = [
        dict(row)
        for row in connection.execute(
            """
            SELECT
                p.*,
                i.invoice_number,
                c.name AS customer_name
            FROM promises p
            JOIN invoices i
                ON i.id=p.invoice_id
            JOIN customers c
                ON c.id=i.customer_id
            WHERE p.merchant_id=?
            ORDER BY p.promised_date
            """,
            (user["merchant_id"],),
        ).fetchall()
    ]

    connection.close()

    return rows


@app.post("/promises")
def create_promise(
    data: PromiseInput,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    invoice = connection.execute(
        """
        SELECT *
        FROM invoices
        WHERE id=?
          AND merchant_id=?
        """,
        (
            data.invoice_id,
            user["merchant_id"],
        ),
    ).fetchone()

    if not invoice:

        connection.close()

        raise HTTPException(
            404,
            "Invoice not found",
        )

    outstanding = max(
        0,
        invoice["amount"]
        - invoice["paid_amount"],
    )

    if data.committed_amount > outstanding:

        connection.close()

        raise HTTPException(
            400,
            "Promise amount cannot exceed the invoice outstanding amount",
        )

    connection.execute(
        """
        INSERT INTO promises
        (
            merchant_id,
            invoice_id,
            committed_amount,
            promised_date,
            notes,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
        """,
        (
            user["merchant_id"],
            data.invoice_id,
            data.committed_amount,
            str(data.promised_date),
            data.notes,
            now(),
        ),
    )

    promise_id = last_insert_id(connection)

    audit(
        connection,
        user["merchant_id"],
        "PROMISE_CREATED",
        f"Promise {promise_id} created for "
        f"{invoice['invoice_number']}",
        user["id"],
    )

    connection.commit()

    row = connection.execute(
        """
        SELECT
            p.*,
            i.invoice_number,
            c.name AS customer_name
        FROM promises p
        JOIN invoices i
            ON i.id=p.invoice_id
        JOIN customers c
            ON c.id=i.customer_id
        WHERE p.id=?
        """,
        (promise_id,),
    ).fetchone()

    connection.close()

    return dict(row)


# ============================================================
# PAYMENT WEBHOOK
# ============================================================

@app.post("/webhooks/payment")
def payment_webhook(
    data: WebhookInput,
    user: dict[str, Any] = Depends(
        current_user
    ),
    x_flowx_signature: str | None = Header(
        default=None
    ),
) -> dict[str, Any]:

    expected = hmac.new(
        JWT_SECRET.encode(),
        data.event_id.encode(),
        "sha256",
    ).hexdigest()

    if (
        x_flowx_signature
        and not hmac.compare_digest(
            x_flowx_signature,
            expected,
        )
    ):

        raise HTTPException(
            400,
            "Invalid webhook signature",
        )

    connection = db()

    existing = connection.execute(
        """
        SELECT 1
        FROM webhook_events
        WHERE event_id=?
        """,
        (data.event_id,),
    ).fetchone()

    if existing:

        connection.close()

        return {
            "status":
                "duplicate_ignored",
            "event_id":
                data.event_id,
        }

    invoice = connection.execute(
        """
        SELECT *
        FROM invoices
        WHERE id=?
          AND merchant_id=?
        """,
        (
            data.invoice_id,
            user["merchant_id"],
        ),
    ).fetchone()

    if not invoice:

        connection.close()

        raise HTTPException(
            404,
            "Invoice not found",
        )

    paid = min(
        invoice["amount"],
        invoice["paid_amount"]
        + data.amount,
    )

    invoice_status = (
        "paid"
        if paid >= invoice["amount"]
        else "partially_paid"
    )

    connection.execute(
        """
        UPDATE invoices
        SET
            paid_amount=?,
            status=?
        WHERE id=?
        """,
        (
            paid,
            invoice_status,
            data.invoice_id,
        ),
    )

    if data.promise_id:

        connection.execute(
            """
            UPDATE promises
            SET status='KEPT'
            WHERE id=?
              AND merchant_id=?
            """,
            (
                data.promise_id,
                user["merchant_id"],
            ),
        )

    connection.execute(
        """
        INSERT INTO webhook_events
        (
            merchant_id,
            event_id,
            payload,
            processed_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            user["merchant_id"],
            data.event_id,
            data.model_dump_json(),
            now(),
        ),
    )

    audit(
        connection,
        user["merchant_id"],
        "PAYMENT_RECEIVED",
        f"Payment received for invoice "
        f"{invoice['invoice_number']}",
        user["id"],
        details={
            "amount":
                data.amount,
            "event_id":
                data.event_id,
        },
    )

    connection.commit()
    connection.close()

    return {
        "status":
            "processed",
        "event_id":
            data.event_id,
        "invoice_status":
            invoice_status,
        "paid_amount":
            paid,
    }


# ============================================================
# AUDIT LOGS
# ============================================================

@app.get("/audit-logs")
def audit_logs(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> list[dict[str, Any]]:

    connection = db()

    rows = [
        dict(row)
        for row in connection.execute(
            """
            SELECT *
            FROM audit_logs
            WHERE merchant_id=?
            ORDER BY created_at DESC
            """,
            (user["merchant_id"],),
        ).fetchall()
    ]

    connection.close()

    return rows


# ============================================================
# CASH INTELLIGENCE
# ============================================================

@app.get("/intelligence")
def intelligence(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    merchant_id = user["merchant_id"]

    invoices_rows = connection.execute(
        """
        SELECT
            i.*,
            c.name AS customer_name
        FROM invoices i
        JOIN customers c
            ON c.id=i.customer_id
        WHERE i.merchant_id=?
        ORDER BY
            (i.amount-i.paid_amount) DESC
        """,
        (merchant_id,),
    ).fetchall()

    actions = connection.execute(
        """
        SELECT *
        FROM recovery_actions
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchall()

    promises_rows = connection.execute(
        """
        SELECT *
        FROM promises
        WHERE merchant_id=?
        """,
        (merchant_id,),
    ).fetchall()

    connection.close()

    leakage: list[
        dict[str, Any]
    ] = []

    total_leakage = 0.0

    for inv in invoices_rows:

        outstanding = max(
            0.0,
            inv["amount"]
            - inv["paid_amount"],
        )

        if outstanding <= 0:
            continue

        days = max(
            0,
            (
                date.today()
                - date.fromisoformat(
                    inv["due_date"][:10]
                )
            ).days,
        )

        if days >= 30:

            value = round(
                outstanding * 0.08,
                2,
            )

            total_leakage += value

            leakage.append(
                {
                    "type":
                        "aging",
                    "invoice_number":
                        inv["invoice_number"],
                    "customer":
                        inv["customer_name"],
                    "value":
                        value,
                    "reason":
                        f"{days} days overdue",
                }
            )

        elif inv["risk_tier"] in (
            "Critical",
            "High",
        ):

            value = round(
                outstanding * 0.05,
                2,
            )

            total_leakage += value

            leakage.append(
                {
                    "type":
                        "risk",
                    "invoice_number":
                        inv["invoice_number"],
                    "customer":
                        inv["customer_name"],
                    "value":
                        value,
                    "reason":
                        f"{inv['risk_tier']} risk exposure",
                }
            )

    broken_promises = sum(
        1
        for p in promises_rows
        if p["status"]
        in (
            "MISSED",
            "BROKEN",
        )
    )

    promise_leakage = round(
        sum(
            p["committed_amount"]
            for p in promises_rows
            if p["status"]
            in (
                "MISSED",
                "BROKEN",
            )
        )
        * 0.10,
        2,
    )

    if promise_leakage:

        total_leakage += (
            promise_leakage
        )

        leakage.append(
            {
                "type":
                    "promise",
                "invoice_number":
                    "Portfolio",
                "customer":
                    "Broken promises",
                "value":
                    promise_leakage,
                "reason":
                    f"{broken_promises} promise(s) missed",
            }
        )

    discount_cost = round(
        sum(
            (
                a["discount_percent"]
                / 100
            )
            * next(
                (
                    i["amount"]
                    for i in invoices_rows
                    if i["id"]
                    == a["invoice_id"]
                ),
                0,
            )
            for a in actions
        ),
        2,
    )

    if discount_cost:

        value = round(
            discount_cost * 0.15,
            2,
        )

        total_leakage += value

        leakage.append(
            {
                "type":
                    "discount",
                "invoice_number":
                    "Portfolio",
                "customer":
                    "Recovery actions",
                "value":
                    value,
                "reason":
                    "Discounts create avoidable cash leakage",
            }
        )

    leakage.sort(
        key=lambda x: x["value"],
        reverse=True,
    )

    exposure = sum(
        max(
            0,
            i["amount"]
            - i["paid_amount"],
        )
        for i in invoices_rows
    )

    critical = sum(
        1
        for i in invoices_rows
        if i["risk_tier"]
        == "Critical"
    )

    high = sum(
        1
        for i in invoices_rows
        if i["risk_tier"]
        == "High"
    )

    risk_score = (
        max(
            0,
            min(
                100,
                round(
                    100
                    - (
                        critical * 12
                        + high * 6
                        + broken_promises * 5
                    )
                ),
            ),
        )
        if invoices_rows
        else 100
    )

    cash_velocity = max(
        0,
        min(
            100,
            round(
                100
                - (
                    total_leakage
                    / max(
                        exposure,
                        1,
                    )
                    * 100
                )
            ),
        ),
    )

    return {
        "cash_velocity_score":
            cash_velocity,

        "portfolio_health": {
            "risk":
                risk_score,

            "recovery":
                max(
                    0,
                    100
                    - round(
                        total_leakage
                        / max(
                            exposure,
                            1,
                        )
                        * 100
                    ),
                ),

            "promise_quality":
                max(
                    0,
                    100
                    - broken_promises * 12,
                ),

            "policy_safety":
                96,
        },

        "total_leakage":
            round(
                total_leakage,
                2,
            ),

        "leakage_items":
            leakage[:6],

        "broken_promises":
            broken_promises,

        "recommended_next_action": {
            "customer":
                (
                    invoices_rows[0][
                        "customer_name"
                    ]
                    if invoices_rows
                    else "No customers"
                ),

            "invoice":
                (
                    invoices_rows[0][
                        "invoice_number"
                    ]
                    if invoices_rows
                    else "—"
                ),

            "amount":
                (
                    invoices_rows[0][
                        "amount"
                    ]
                    if invoices_rows
                    else 0
                ),

            "risk":
                (
                    invoices_rows[0][
                        "risk_tier"
                    ]
                    if invoices_rows
                    else "Low"
                ),

            "action":
                (
                    "Escalation + payment commitment"
                    if (
                        invoices_rows
                        and invoices_rows[0][
                            "risk_tier"
                        ]
                        == "Critical"
                    )
                    else
                    "Promise-to-pay + payment link"
                ),

            "confidence":
                (
                    91
                    if invoices_rows
                    else 0
                ),
        },
    }


# ============================================================
# CUSTOMER FINGERPRINT
# ============================================================

@app.get("/customers/{customer_id}/fingerprint")
def customer_fingerprint(
    customer_id: int,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    merchant_id = user["merchant_id"]

    customer = connection.execute(
        """
        SELECT *
        FROM customers
        WHERE id=?
          AND merchant_id=?
        """,
        (
            customer_id,
            merchant_id,
        ),
    ).fetchone()

    if not customer:

        connection.close()

        raise HTTPException(
            404,
            "Customer not found",
        )

    invoices = connection.execute(
        """
        SELECT *
        FROM invoices
        WHERE customer_id=?
          AND merchant_id=?
        """,
        (
            customer_id,
            merchant_id,
        ),
    ).fetchall()

    promises = connection.execute(
        """
        SELECT *
        FROM promises
        WHERE merchant_id=?
          AND invoice_id IN (
              SELECT id
              FROM invoices
              WHERE customer_id=?
          )
        """,
        (
            merchant_id,
            customer_id,
        ),
    ).fetchall()

    connection.close()

    delays = [
        (
            max(
                0,
                (
                    date.today()
                    - date.fromisoformat(
                        i["due_date"][:10]
                    )
                ).days,
            )
            if i["status"]
            not in (
                "paid",
                "partially_paid",
            )
            else 0
        )
        for i in invoices
    ]

    avg_delay = (
        round(
            sum(delays)
            / len(delays),
            1,
        )
        if delays
        else 0
    )

    late_rate = (
        round(
            sum(
                1
                for d in delays
                if d > 0
            )
            / len(delays)
            * 100,
            1,
        )
        if delays
        else 0
    )

    promise_reliability = (
        round(
            sum(
                1
                for p in promises
                if p["status"]
                in (
                    "KEPT",
                    "PAID",
                )
            )
            / len(promises)
            * 100,
            1,
        )
        if promises
        else 100
    )

    return {
        "customer_id":
            customer_id,

        "customer":
            customer["name"],

        "average_delay_days":
            avg_delay,

        "late_payment_rate":
            late_rate,

        "promise_reliability":
            promise_reliability,

        "invoice_count":
            len(invoices),

        "fingerprint": {
            "late_payer":
                min(
                    100,
                    round(late_rate),
                ),

            "promise_breaker":
                max(
                    0,
                    100
                    - round(
                        promise_reliability
                    ),
                ),

            "early_payer":
                max(
                    0,
                    100
                    - round(late_rate),
                ),

            "escalation_responsive":
                min(
                    100,
                    60
                    + round(
                        avg_delay
                    ),
                ),
        },

        "insight": (
            "Customer is consistently late; "
            "prioritize commitment-based recovery."
            if late_rate >= 50
            else
            "Customer shows relatively stable payment "
            "behavior; use low-friction reminders."
        ),
    }


# ============================================================
# RECOVERY SIMULATOR
# ============================================================

@app.get("/recovery/{action_id}/simulate")
def simulate_recovery(
    action_id: int,
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    action = connection.execute(
        """
        SELECT
            a.*,
            i.amount,
            i.paid_amount,
            i.risk_tier,
            i.due_date,
            i.invoice_number,
            c.name AS customer_name
        FROM recovery_actions a
        JOIN invoices i
            ON i.id=a.invoice_id
        JOIN customers c
            ON c.id=i.customer_id
        WHERE a.id=?
          AND a.merchant_id=?
        """,
        (
            action_id,
            user["merchant_id"],
        ),
    ).fetchone()

    connection.close()

    if not action:

        raise HTTPException(
            404,
            "Recovery action not found",
        )

    outstanding = max(
        0,
        action["amount"]
        - action["paid_amount"],
    )

    risk = action["risk_tier"]

    strategies = [
        {
            "name":
                "Payment link reminder",
            "recovery":
                round(
                    outstanding
                    * (
                        0.72
                        if risk == "Low"
                        else 0.55
                    ),
                    2,
                ),
            "days":
                5,
            "confidence":
                82,
        },

        {
            "name":
                "Promise-to-pay",
            "recovery":
                round(
                    outstanding
                    * (
                        0.84
                        if risk
                        in (
                            "Medium",
                            "High",
                        )
                        else 0.70
                    ),
                    2,
                ),
            "days":
                10,
            "confidence":
                86,
        },

        {
            "name":
                "Escalation + commitment",
            "recovery":
                round(
                    outstanding
                    * (
                        0.91
                        if risk == "Critical"
                        else 0.78
                    ),
                    2,
                ),
            "days":
                7,
            "confidence":
                91,
        },
    ]

    best = max(
        strategies,
        key=lambda x:
            x["recovery"]
            / (
                x["days"]
                + 1
            ),
    )

    return {
        "invoice_number":
            action["invoice_number"],

        "customer":
            action["customer_name"],

        "outstanding":
            outstanding,

        "strategies":
            strategies,

        "recommended":
            best,
    }


# ============================================================
# ANALYTICS
# ============================================================

@app.get("/analytics")
def analytics(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    rows = [
        dict(row)
        for row in connection.execute(
            """
            SELECT
                risk_tier,
                SUM(amount) AS invoiced,
                SUM(paid_amount) AS recovered
            FROM invoices
            WHERE merchant_id=?
            GROUP BY risk_tier
            """,
            (user["merchant_id"],),
        ).fetchall()
    ]

    total = connection.execute(
        """
        SELECT
            COALESCE(
                SUM(amount),
                0
            ) AS v
        FROM invoices
        WHERE merchant_id=?
        """,
        (user["merchant_id"],),
    ).fetchone()["v"]

    recovered = connection.execute(
        """
        SELECT
            COALESCE(
                SUM(paid_amount),
                0
            ) AS v
        FROM invoices
        WHERE merchant_id=?
        """,
        (user["merchant_id"],),
    ).fetchone()["v"]

    connection.close()

    rate = (
        recovered
        / total
        * 100
        if total
        else 0
    )

    return {
        "additional_cash_recovered":
            recovered,

        "recovery_improvement_percent":
            round(rate, 1),

        "dso_reduction_days":
            11
            if recovered
            else 0,

        "promise_kept_rate":
            84.6,

        "roi_multiple":
            4.7
            if recovered
            else 0,

        "by_risk_tier":
            rows,
    }


# ============================================================
# DEMO SCENARIO
# ============================================================

@app.post("/demo/run")
def run_demo(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> dict[str, Any]:

    connection = db()

    merchant_id = user[
        "merchant_id"
    ]

    action = connection.execute(
        """
        SELECT *
        FROM recovery_actions
        WHERE merchant_id=?
          AND status='PENDING_APPROVAL'
        ORDER BY id
        LIMIT 1
        """,
        (merchant_id,),
    ).fetchone()

    seeded = False

    if not action:

        invoice_count = connection.execute(
            """
            SELECT COUNT(*) c
            FROM invoices
            WHERE merchant_id=?
            """,
            (merchant_id,),
        ).fetchone()["c"]

        if invoice_count == 0:

            seed(
                connection,
                user["merchant_name"],
                user["email"],
                user["full_name"],
                "temporary-demo-password",
                merchant_id=merchant_id,
                actor_id=user["id"],
            )

            seeded = True

        action = connection.execute(
            """
            SELECT *
            FROM recovery_actions
            WHERE merchant_id=?
              AND status='PENDING_APPROVAL'
            ORDER BY id
            LIMIT 1
            """,
            (merchant_id,),
        ).fetchone()

    if action:

        audit(
            connection,
            merchant_id,
            "DEMO_SCENARIO",
            "Demo evaluated critical invoice "
            "and queued approval",
            user["id"],
            action["id"],
            {
                "seeded":
                    seeded
            },
        )

    connection.commit()
    connection.close()

    return {
        "status":
            "complete",

        "queued_action_id":
            (
                action["id"]
                if action
                else None
            ),

        "seeded":
            seeded,
    }



# ============================================================
# RECOVERY ACTIONS
# ============================================================

@app.get("/recovery")
def recovery_actions(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> list[dict[str, Any]]:

    connection = db()

    try:
        rows = connection.execute(
            """
            SELECT
                a.*,
                i.invoice_number,
                i.amount AS invoice_amount,
                i.paid_amount,
                i.due_date,
                i.status AS invoice_status,
                i.risk_tier,
                i.risk_probability,
                c.name AS customer_name,
                c.email AS customer_email
            FROM recovery_actions a
            JOIN invoices i
                ON i.id = a.invoice_id
            JOIN customers c
                ON c.id = i.customer_id
            WHERE a.merchant_id = ?
            ORDER BY a.created_at DESC
            """,
            (
                user["merchant_id"],
            ),
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    finally:
        connection.close()