const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_URL = RAW_API_URL.replace(/\/+$/, "");

export type User = { id: number; email: string; full_name: string; role: string; merchant_id: number; merchant_name: string };
export type Invoice = { id: number; invoice_number: string; customer_name: string; customer_email?: string; amount: number; paid_amount: number; issue_date: string; due_date: string; status: string; risk_tier: string; risk_probability: number; predicted_delay_days: number; description: string };
export type RecoveryAction = { id: number; invoice_id: number; invoice_number: string; customer_name: string; invoice_amount: number; risk_tier: string; status: string; action_type: string; reason: string; confidence: number; discount_percent: number };
export type PromiseRecord = { id: number; invoice_id: number; invoice_number: string; customer_name: string; committed_amount: number; promised_date: string; notes: string; status: string };

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
  metrics: { total_receivables: number; cash_recovered: number; at_risk: number; promise_kept_rate: number };
  actions: Array<{ id: number; invoice_number: string; customer_name: string; invoice_amount: number; due_date: string; risk_tier: string; status: string }>;
  risk_distribution: Array<{ risk_tier: string; exposure: number; count: number }>;
  recovery_trend: Array<{ month: string; flowx: number; baseline: number }>;
  policy: { max_discount_percent: number; approval_threshold_percent: number; high_value_threshold: number };
  synced_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("flowx_token") : null;
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } });
  if (response.status === 401 && typeof window !== "undefined") {
    logout();
    if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) window.location.replace("/login?reason=session-expired");
  }
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "FLOWX API request failed");
  return response.json();
}

export async function ensureDemoSession(): Promise<void> {
  if (typeof window === "undefined" || !localStorage.getItem("flowx_token")) {
    throw new Error("Authentication required");
  }
}

export async function login(email: string, password: string): Promise<User> {
  const response = await request<{ access_token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  localStorage.setItem("flowx_token", response.access_token); localStorage.setItem("flowx_user", JSON.stringify(response.user)); document.cookie = "flowx_session=1; path=/; SameSite=Lax"; return response.user;
}
export async function register(payload: { email: string; password: string; full_name: string; merchant_name: string }): Promise<User> {
  const response = await request<{ access_token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(payload) });
  localStorage.setItem("flowx_token", response.access_token); localStorage.setItem("flowx_user", JSON.stringify(response.user)); document.cookie = "flowx_session=1; path=/; SameSite=Lax"; return response.user;
}
export function logout(): void { localStorage.removeItem("flowx_token"); localStorage.removeItem("flowx_user"); document.cookie = "flowx_session=; Max-Age=0; path=/; SameSite=Lax"; }
export async function getInvoices(risk?: string): Promise<Invoice[]> { await ensureDemoSession(); return request<Invoice[]>(`/invoices${risk ? `?risk=${risk}` : ""}`); }
export async function createInvoice(payload: { invoice_number: string; customer_name: string; customer_email: string; issue_date: string; due_date: string; amount: number; paid_amount: number; description: string }): Promise<Invoice> { return request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(payload) }); }
export async function importInvoices(file: File): Promise<{ created: number; skipped: string[] }> { await ensureDemoSession(); const token = localStorage.getItem("flowx_token"); const body = new FormData(); body.append("file", file); const response = await fetch(`${API_URL}/invoices/import`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "Invoice import failed"); return response.json(); }
export async function getRecoveryActions(): Promise<RecoveryAction[]> { await ensureDemoSession(); return request<DashboardData>("/dashboard").then((data) => data.actions as unknown as RecoveryAction[]); }
export async function executeAction(id: number): Promise<void> { await request(`/recovery/${id}/execute`, { method: "POST" }); }
export async function getPromises(): Promise<PromiseRecord[]> { await ensureDemoSession(); return request<PromiseRecord[]>("/promises"); }
export async function createPromise(payload: { invoice_id: number; committed_amount: number; promised_date: string; notes: string }): Promise<PromiseRecord> { return request<PromiseRecord>("/promises", { method: "POST", body: JSON.stringify(payload) }); }
export async function getAnalytics(): Promise<Record<string, unknown>> { await ensureDemoSession(); return request<Record<string, unknown>>("/analytics"); }
export async function getAuditLogs(): Promise<Array<Record<string, unknown>>> { await ensureDemoSession(); return request<Array<Record<string, unknown>>>("/audit-logs"); }
export async function getPolicy(): Promise<Record<string, unknown>> { await ensureDemoSession(); return request<Record<string, unknown>>("/policies"); }
export async function updatePolicy(payload: Record<string, unknown>): Promise<Record<string, unknown>> { return request<Record<string, unknown>>("/policies", { method: "PUT", body: JSON.stringify(payload) }); }
export async function getHealth(): Promise<Record<string, unknown>> { return request<Record<string, unknown>>("/health"); }

export async function getDashboard(): Promise<DashboardData> { await ensureDemoSession(); return request<DashboardData>("/dashboard"); }
export async function approveAction(id: number): Promise<void> { await request(`/recovery/${id}/approve`, { method: "POST" }); }
export async function runDemo(): Promise<void> { await request("/demo/run", { method: "POST" }); }

export type IntelligenceData = {
  cash_velocity_score: number;
  portfolio_health: { risk: number; recovery: number; promise_quality: number; policy_safety: number };
  total_leakage: number;
  leakage_items: Array<{ type: string; invoice_number: string; customer: string; value: number; reason: string }>;
  broken_promises: number;
  recommended_next_action: { customer: string; invoice: string; amount: number; risk: string; action: string; confidence: number };
};
export async function getIntelligence(): Promise<IntelligenceData> { await ensureDemoSession(); return request<IntelligenceData>("/intelligence"); }
export async function simulateRecovery(id: number): Promise<Record<string, unknown>> { await ensureDemoSession(); return request<Record<string, unknown>>(`/recovery/${id}/simulate`); }



export type RiskDriver = {
  factor: string;
  value: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
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

  risk_drivers: RiskDriver[];

  customer_behavior: {
    invoice_count: number;
    late_payment_rate: number;
    average_delay_days: number;
  };

  strategies: RecoveryStrategy[];

  recommended_strategy: RecoveryStrategy;

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

  recommendation_reason: string;

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

  return request<InvoiceDecision>(
    `/invoices/${invoiceId}/decision`
  );
}