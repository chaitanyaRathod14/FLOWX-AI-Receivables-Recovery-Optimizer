const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const API_URL = RAW_API_URL.replace(/\/+$/, "");

/* =========================================================
   TYPES
   ========================================================= */

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  merchant_id: string;
  merchant_name: string;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  amount: number;
  paid_amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  risk_tier: string;
  risk_probability: number;
  predicted_delay_days: number;
  description: string;
};

export type RecoveryAction = {
  id: number;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  invoice_amount: number;
  risk_tier: string;
  status: string;
  action_type: string;
  reason: string;
  confidence: number;
  discount_percent: number;
};

export type PromiseRecord = {
  id: number;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  committed_amount: number;
  promised_date: string;
  notes: string;
  status: string;
};

export type DashboardAction = {
  id: number;
  action_id: string;
  customer: string;
  invoice: string;
  amount: string;
  risk: string;
  detail: string;
  status: string;
  tone: string;
};

export type DashboardData = {
  metrics: {
    total_receivables: number;
    cash_recovered: number;
    at_risk: number;
    promise_kept_rate: number;
  };

  actions: Array<{
    id: number;
    invoice_number: string;
    customer_name: string;
    invoice_amount: number;
    due_date: string;
    risk_tier: string;
    status: string;
  }>;

  risk_distribution: Array<{
    risk_tier: string;
    exposure: number;
    count: number;
  }>;

  recovery_trend: Array<{
    month: string;
    flowx: number;
    baseline: number;
  }>;

  policy: {
    max_discount_percent: number;
    approval_threshold_percent: number;
    high_value_threshold: number;
  };

  synced_at: string;
};

/* =========================================================
   SESSION HELPERS
   ========================================================= */

const TOKEN_KEY = "flowx_token";
const USER_KEY = "flowx_user";
const SESSION_COOKIE = "flowx_session";

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

function setSession(
  token: string,
  user: User
): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    TOKEN_KEY,
    token
  );

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );

  /*
   * This cookie is only used by Next.js proxy.ts
   * to know that the browser has an authenticated session.
   *
   * Actual API authentication is still done using
   * the JWT stored in localStorage.
   */
  document.cookie =
    `${SESSION_COOKIE}=1; ` +
    `Max-Age=${60 * 60 * 24 * 7}; ` +
    `Path=/; ` +
    `SameSite=Lax`;
}

function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  document.cookie =
    `${SESSION_COOKIE}=; ` +
    `Max-Age=0; ` +
    `Path=/; ` +
    `SameSite=Lax`;
}

/* =========================================================
   COMMON API REQUEST HELPER
   ========================================================= */

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {

  const token = getToken();

  const headers = new Headers(
    init?.headers
  );

  /*
   * Do not set JSON content type for FormData.
   */
  if (!(init?.body instanceof FormData)) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  /*
   * Attach JWT to every authenticated API request.
   */
  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...init,
      headers,
    }
  );

  /*
   * Backend rejected the JWT.
   *
   * This usually means:
   * 1. Token expired
   * 2. FLOWX_JWT_SECRET changed
   * 3. Token is malformed
   * 4. User was deleted/deactivated
   */
  if (
    response.status === 401 &&
    typeof window !== "undefined"
  ) {

    clearSession();

    const currentPath =
      window.location.pathname;

    if (
      !currentPath.startsWith("/login") &&
      !currentPath.startsWith("/register")
    ) {
      window.location.replace(
        "/login?reason=session-expired"
      );
    }

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  if (!response.ok) {

    const errorData =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      errorData?.detail ||
        `FLOWX API request failed (${response.status})`
    );
  }

  return response.json();
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */

export async function ensureDemoSession(): Promise<void> {

  if (typeof window === "undefined") {
    throw new Error(
      "Authentication required"
    );
  }

  const token =
    localStorage.getItem(
      TOKEN_KEY
    );

  if (!token) {
    throw new Error(
      "Authentication required"
    );
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

export async function login(
  email: string,
  password: string
): Promise<User> {

  const response =
    await request<{
      access_token: string;
      token_type: string;
      user: User;
    }>(
      "/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

  /*
   * IMPORTANT:
   * Save the JWT returned by FastAPI.
   */
  setSession(
    response.access_token,
    response.user
  );

  return response.user;
}

/* =========================================================
   REGISTER
   ========================================================= */

export async function register(
  payload: {
    email: string;
    password: string;
    full_name: string;
    merchant_name: string;
    industry?: string;
    currency?: string;
  }
): Promise<User> {

  const response =
    await request<{
      access_token: string;
      token_type: string;
      user: User;
    }>(
      "/auth/register",
      {
        method: "POST",

        body: JSON.stringify({
          email:
            payload.email,

          password:
            payload.password,

          full_name:
            payload.full_name,

          merchant_name:
            payload.merchant_name,

          industry:
            payload.industry,

          currency:
            payload.currency,
        }),
      }
    );

  /*
   * Automatically create a session
   * after successful registration.
   */
  setSession(
    response.access_token,
    response.user
  );

  return response.user;
}

/* =========================================================
   LOGOUT
   ========================================================= */

export function logout(): void {
  clearSession();
}

/* =========================================================
   INVOICES
   ========================================================= */

export async function getInvoices(
  risk?: string
): Promise<Invoice[]> {

  await ensureDemoSession();

  const query = risk
    ? `?risk=${encodeURIComponent(risk)}`
    : "";

  return request<Invoice[]>(
    `/invoices${query}`
  );
}

export async function createInvoice(
  payload: {
    invoice_number: string;
    customer_name: string;
    customer_email: string;
    issue_date: string;
    due_date: string;
    amount: number;
    paid_amount: number;
    description: string;
  }
): Promise<Invoice> {

  await ensureDemoSession();

  return request<Invoice>(
    "/invoices",
    {
      method: "POST",

      body: JSON.stringify(
        payload
      ),
    }
  );
}

/* =========================================================
   CSV IMPORT
   ========================================================= */

export async function importInvoices(
  file: File
): Promise<{
  created: number;
  skipped: string[];
}> {

  await ensureDemoSession();

  const token =
    getToken();

  const body =
    new FormData();

  body.append(
    "file",
    file
  );

  const headers: HeadersInit = {};

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      `${API_URL}/invoices/import`,
      {
        method: "POST",
        headers,
        body,
      }
    );

  if (
    response.status === 401 &&
    typeof window !== "undefined"
  ) {

    clearSession();

    const currentPath =
      window.location.pathname;

    if (
      !currentPath.startsWith("/login") &&
      !currentPath.startsWith("/register")
    ) {
      window.location.replace(
        "/login?reason=session-expired"
      );
    }

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  if (!response.ok) {

    const errorData =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      errorData?.detail ||
        "Invoice import failed"
    );
  }

  return response.json();
}

/* =========================================================
   DASHBOARD
   ========================================================= */

export async function getDashboard():
  Promise<DashboardData> {

  await ensureDemoSession();

  return request<DashboardData>(
    "/dashboard"
  );
}

/* =========================================================
   RECOVERY
   ========================================================= */

export async function getRecoveryActions():
  Promise<RecoveryAction[]> {

  await ensureDemoSession();

  return request<RecoveryAction[]>(
    "/recovery"
  );
}

export async function executeAction(
  id: number
): Promise<void> {

  await ensureDemoSession();

  await request(
    `/recovery/${id}/execute`,
    {
      method: "POST",
    }
  );
}

export async function approveAction(
  id: number
): Promise<void> {

  await ensureDemoSession();

  await request(
    `/recovery/${id}/approve`,
    {
      method: "POST",
    }
  );
}

export async function simulateRecovery(
  id: number
): Promise<
  Record<string, unknown>
> {

  await ensureDemoSession();

  return request<
    Record<string, unknown>
  >(
    `/recovery/${id}/simulate`
  );
}

/* =========================================================
   PROMISES TO PAY
   ========================================================= */

export async function getPromises():
  Promise<PromiseRecord[]> {

  await ensureDemoSession();

  return request<
    PromiseRecord[]
  >(
    "/promises"
  );
}

export async function createPromise(
  payload: {
    invoice_id: number;
    committed_amount: number;
    promised_date: string;
    notes: string;
  }
): Promise<PromiseRecord> {

  await ensureDemoSession();

  return request<
    PromiseRecord
  >(
    "/promises",
    {
      method: "POST",

      body: JSON.stringify(
        payload
      ),
    }
  );
}

/* =========================================================
   ANALYTICS
   ========================================================= */

export async function getAnalytics():
  Promise<
    Record<string, unknown>
  > {

  await ensureDemoSession();

  return request<
    Record<string, unknown>
  >(
    "/analytics"
  );
}

/* =========================================================
   INTELLIGENCE
   ========================================================= */

export type IntelligenceData = {

  cash_velocity_score: number;

  portfolio_health: {
    risk: number;
    recovery: number;
    promise_quality: number;
    policy_safety: number;
  };

  total_leakage: number;

  leakage_items: Array<{
    type: string;
    invoice_number: string;
    customer: string;
    value: number;
    reason: string;
  }>;

  broken_promises: number;

  recommended_next_action: {
    customer: string;
    invoice: string;
    amount: number;
    risk: string;
    action: string;
    confidence: number;
  };
};

export async function getIntelligence():
  Promise<IntelligenceData> {

  await ensureDemoSession();

  return request<
    IntelligenceData
  >(
    "/intelligence"
  );
}

/* =========================================================
   INVOICE DECISION / CASH INTELLIGENCE
   ========================================================= */

export type RiskDriver = {
  factor: string;
  value: string;
  impact:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  explanation: string;
};

export type RecoveryStrategy = {
  name: string;
  type: string;
  expected_recovery: number;
  expected_days: number;
  confidence: number;
  available: boolean;
  reason: string;
  discount_percent?: number;
  discount_cost?: number;
  requires_approval?: boolean;
};

export type InvoiceDecision = {

  invoice: {
    id: number;
    invoice_number: string;
    customer_name: string;
    amount: number;
    paid_amount: number;
    outstanding: number;
    due_date: string;
    overdue_days: number;
    status: string;
  };

  risk: {
    tier: string;
    probability: number;
    predicted_delay_days: number;
  };

  risk_drivers:
    RiskDriver[];

  customer_behavior: {
    invoice_count: number;
    late_payment_rate: number;
    average_delay_days: number;
  };

  strategies:
    RecoveryStrategy[];

  recommended_strategy:
    RecoveryStrategy;

  cash_impact: {
    outstanding: number;
    do_nothing_expected_recovery: number;
    recommended_expected_recovery: number;
    cash_acceleration: number;
    estimated_days_saved: number;
  };

  forecast: {
    "7_days": number;
    "14_days": number;
    "30_days": number;
  };

  recommendation_reason:
    string;

  policy: {
    max_discount_percent: number;
    approval_threshold_percent: number;
    high_value_threshold: number;
  };
};

export async function getInvoiceDecision(
  invoiceId: number
): Promise<InvoiceDecision> {

  await ensureDemoSession();

  return request<
    InvoiceDecision
  >(
    `/invoices/${invoiceId}/decision`
  );
}

/* =========================================================
   AUDIT LOGS
   ========================================================= */

export async function getAuditLogs():
  Promise<
    Array<Record<string, unknown>>
  > {

  await ensureDemoSession();

  return request<
    Array<Record<string, unknown>>
  >(
    "/audit-logs"
  );
}

/* =========================================================
   POLICIES
   ========================================================= */

export async function getPolicy():
  Promise<
    Record<string, unknown>
  > {

  await ensureDemoSession();

  return request<
    Record<string, unknown>
  >(
    "/policies"
  );
}

export async function updatePolicy(
  payload:
    Record<string, unknown>
): Promise<
  Record<string, unknown>
> {

  await ensureDemoSession();

  return request<
    Record<string, unknown>
  >(
    "/policies",
    {
      method: "PUT",

      body: JSON.stringify(
        payload
      ),
    }
  );
}

/* =========================================================
   HEALTH
   ========================================================= */

export async function getHealth():
  Promise<
    Record<string, unknown>
  > {

  return request<
    Record<string, unknown>
  >(
    "/health"
  );
}

/* =========================================================
   DEMO
   ========================================================= */

export async function runDemo():
  Promise<void> {

  await ensureDemoSession();

  await request(
    "/demo/run",
    {
      method: "POST",
    }
  );
}