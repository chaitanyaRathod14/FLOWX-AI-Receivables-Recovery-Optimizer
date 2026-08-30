BEGIN;

CREATE TABLE IF NOT EXISTS merchants (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS policies (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT UNIQUE NOT NULL REFERENCES merchants(id),
    max_discount_percent REAL NOT NULL DEFAULT 5,
    approval_threshold_percent REAL NOT NULL DEFAULT 2,
    high_value_threshold REAL NOT NULL DEFAULT 10000,
    max_automated_reminders INTEGER NOT NULL DEFAULT 3,
    early_payment_discounts INTEGER NOT NULL DEFAULT 1,
    automated_reminders INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id),
    customer_id BIGINT NOT NULL REFERENCES customers(id),
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
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
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
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    committed_amount REAL NOT NULL,
    promised_date TEXT NOT NULL,
    notes TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    event_id TEXT UNIQUE NOT NULL,
    payload TEXT NOT NULL,
    processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    actor_id BIGINT,
    action_id BIGINT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_merchant_id ON users (merchant_id);
CREATE INDEX IF NOT EXISTS idx_policies_merchant_id ON policies (merchant_id);
CREATE INDEX IF NOT EXISTS idx_customers_merchant_id ON customers (merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices (merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_merchant_id ON recovery_actions (merchant_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_invoice_id ON recovery_actions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_promises_merchant_id ON promises (merchant_id);
CREATE INDEX IF NOT EXISTS idx_promises_invoice_id ON promises (invoice_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant_id ON webhook_events (merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON audit_logs (merchant_id);

COMMIT;
