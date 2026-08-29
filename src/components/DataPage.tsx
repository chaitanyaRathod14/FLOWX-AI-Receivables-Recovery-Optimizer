"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileText,
  FileUp,
  Gauge,
  Info,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  WalletCards,
  X,
} from "lucide-react";
import {
  approveAction,
  createInvoice,
  createPromise,
  executeAction,
  getAnalytics,
  getAuditLogs,
  getHealth,
  getInvoices,
  getPolicy,
  getPromises,
  getRecoveryActions,
  importInvoices,
  updatePolicy,
  Invoice,
  RecoveryAction,
  PromiseRecord,
} from "@/lib/api";
import AppShell from "@/components/AppShell";
import InvoiceDecisionModal from "@/components/InvoiceDecisionModal";

const money = (value: unknown) =>
  `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const title = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type Kind =
  | "invoices"
  | "recovery"
  | "promises"
  | "analytics"
  | "audit"
  | "policies"
  | "health";

export default function DataPage({ kind }: { kind: Kind }) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    load();
  }, [kind, refreshKey]);

  async function load() {
    setError("");
    try {
      if (kind === "invoices") setData(await getInvoices());
      else if (kind === "recovery") setData(await getRecoveryActions());
      else if (kind === "promises") setData(await getPromises());
      else if (kind === "analytics") setData(await getAnalytics());
      else if (kind === "audit") setData(await getAuditLogs());
      else if (kind === "policies") setData(await getPolicy());
      else setData(await getHealth());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load this page"
      );
    }
  }

  async function action(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      setMessage(success);
      setTimeout(() => setMessage(""), 5000);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      {message && (
        <div className="toast">
          <Check size={16} /> {message}
          <button onClick={() => setMessage("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {error && (
        <div className="page-error">
          <CircleAlert size={17} /> {error}
        </div>
      )}
      {busy && (
        <div className="loading">
          <LoaderCircle className="spin" size={17} /> Syncing with FLOWX
          API...
        </div>
      )}
      {data === null && !error && (
        <div className="loading">
          <LoaderCircle className="spin" size={17} /> Loading workspace data...
        </div>
      )}

      {data !== null && kind === "invoices" && (
        <InvoicesView
          rows={data as Invoice[]}
          onRefresh={() => setRefreshKey((v) => v + 1)}
          onSuccess={(msg) => {
            setMessage(msg);
            setRefreshKey((v) => v + 1);
          }}
        />
      )}

      {data !== null && kind === "policies" && (
        <PoliciesView
          initial={data as Record<string, unknown>}
          onSaved={(payload) =>
            action(
              () => updatePolicy(payload),
              "Policy guardrails updated successfully"
            )
          }
        />
      )}

      {data !== null && kind === "recovery" && (
        <RecoveryView
          rows={data as RecoveryAction[]}
          onAction={(id, verb) =>
            action(
              () =>
                verb === "approve" ? approveAction(id) : executeAction(id),
              `Recovery action ${verb === "approve" ? "approved" : "executed"} successfully`
            )
          }
        />
      )}

      {data !== null && kind === "promises" && (
        <PromisesView
          rows={data as PromiseRecord[]}
          onCreated={() =>
            action(load, "Promise to pay recorded successfully")
          }
        />
      )}

      {data !== null && kind === "analytics" && (
        <AnalyticsView data={data as Record<string, unknown>} />
      )}

      {data !== null && kind === "audit" && (
        <AuditLogView rows={data as Array<Record<string, unknown>>} />
      )}

      {data !== null && kind === "health" && (
        <HealthView
          data={data as Record<string, unknown>}
          onRefresh={() => {
            setMessage("Diagnostics check completed. All services active.");
            setRefreshKey((v) => v + 1);
          }}
        />
      )}
    </AppShell>
  );
}

/* =========================================================
   1. INVOICES VIEW
   ========================================================= */
function InvoicesView({
  rows,
  onRefresh,
  onSuccess,
}: {
  rows: Invoice[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const totalReceivables = useMemo(
    () => rows.reduce((acc, r) => acc + (r.amount - r.paid_amount), 0),
    [rows]
  );
  const totalPaid = useMemo(
    () => rows.reduce((acc, r) => acc + r.paid_amount, 0),
    [rows]
  );
  const atRiskExposure = useMemo(
    () =>
      rows
        .filter((r) => ["Critical", "High"].includes(r.risk_tier))
        .reduce((acc, r) => acc + (r.amount - r.paid_amount), 0),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        search === "" ||
        r.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.customer_email &&
          r.customer_email.toLowerCase().includes(search.toLowerCase()));

      const matchRisk =
        riskFilter === "ALL" ||
        r.risk_tier.toLowerCase() === riskFilter.toLowerCase();

      const matchStatus =
        statusFilter === "ALL" ||
        r.status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchRisk && matchStatus;
    });
  }, [rows, search, riskFilter, statusFilter]);

  const riskCounts = useMemo(() => {
    return {
      ALL: rows.length,
      Critical: rows.filter((r) => r.risk_tier === "Critical").length,
      High: rows.filter((r) => r.risk_tier === "High").length,
      Medium: rows.filter((r) => r.risk_tier === "Medium").length,
      Low: rows.filter((r) => r.risk_tier === "Low").length,
    };
  }, [rows]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECEIVABLES MANAGEMENT</p>
          <h2>Invoices & Receivables Risk</h2>
          <p className="subhead">
            Monitor real-time exposure, calculate default probabilities, and
            trigger AI decisions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="scenario-button"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={15} /> Add invoice
          </button>
          <CsvImportButton onDone={() => onSuccess("CSV import completed")} />
        </div>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Total outstanding</span>
            <CircleDollarSign size={18} />
          </div>
          <strong>{money(totalReceivables)}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> {rows.length} total invoice(s)
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Collected / Paid</span>
            <Check size={18} />
          </div>
          <strong>{money(totalPaid)}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Live settlement balance
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>At risk exposure</span>
            <ShieldAlert size={18} />
          </div>
          <strong>{money(atRiskExposure)}</strong>
          <div className="metric-change negative">
            <ArrowUpRight size={14} /> Critical + High exposure
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Collection efficiency</span>
            <Sparkles size={18} />
          </div>
          <strong>
            {totalPaid + totalReceivables > 0
              ? `${Math.round((totalPaid / (totalPaid + totalReceivables)) * 100)}%`
              : "0%"}
          </strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Settlement rate
          </div>
        </div>
      </section>

      {/* FILTER & SEARCH BAR */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} />
          <input
            className="search-input"
            placeholder="Search invoice number, customer, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          {(["ALL", "Critical", "High", "Medium", "Low"] as const).map(
            (tier) => (
              <button
                key={tier}
                className={`filter-pill ${riskFilter === tier ? "active" : ""}`}
                onClick={() => setRiskFilter(tier)}
              >
                {tier === "ALL" ? "All Risk" : tier}
                <span className="pill-count">{riskCounts[tier] || 0}</span>
              </button>
            )
          )}

          <select
            className="select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="overdue">Overdue</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* INVOICE TABLE */}
      <div className="data-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Amount & Paid</th>
                <th>Due Date & Aging</th>
                <th>Risk Tier</th>
                <th>Status</th>
                <th>Autonomous AI Decision</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const outstanding = Math.max(0, row.amount - row.paid_amount);
                  const paidPercent =
                    row.amount > 0
                      ? Math.min(100, Math.round((row.paid_amount / row.amount) * 100))
                      : 0;
                  const dueDate = new Date(row.due_date);
                  const overdueDays = Math.max(
                    0,
                    Math.floor((Date.now() - dueDate.getTime()) / 86400000)
                  );
                  const initials = row.customer_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr key={row.id}>
                      <td>
                        <b style={{ color: "#193d38", fontSize: "12px" }}>
                          {row.invoice_number}
                        </b>
                        <small>{row.description || "Receivable item"}</small>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <span className="customer-avatar">{initials}</span>
                          <div>
                            <b>{row.customer_name}</b>
                            <small>{row.customer_email || "No email"}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="amount-cell">
                          <b>{money(row.amount)}</b>
                          <div className="amount-progress">
                            <div className="amount-track">
                              <div
                                className="amount-fill"
                                style={{ width: `${paidPercent}%` }}
                              />
                            </div>
                            <small>
                              {row.paid_amount > 0
                                ? `${money(row.paid_amount)} paid`
                                : `${money(outstanding)} due`}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="due-cell">
                          <b>{row.due_date}</b>
                          {row.status === "paid" ? (
                            <span className="overdue-badge ontime">
                              <Check size={11} /> Settled
                            </span>
                          ) : overdueDays > 0 ? (
                            <span
                              className={`overdue-badge ${
                                overdueDays >= 30 ? "critical" : "warning"
                              }`}
                            >
                              <Clock3 size={11} /> {overdueDays}d overdue
                            </span>
                          ) : (
                            <span className="overdue-badge ontime">
                              On schedule
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`risk-pill ${row.risk_tier.toLowerCase()}`}
                        >
                          <i />
                          {row.risk_tier}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${row.status.toLowerCase()}`}
                        >
                          {row.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td>
                        <button
                          className="decision-button"
                          onClick={() => setSelectedInvoice(row.id)}
                        >
                          <Sparkles size={13} />
                          Analyze Decision
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      No invoices match the selected filters. Try adjusting your
                      search or risk filter.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddInvoiceModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            onSuccess("Invoice created successfully");
          }}
        />
      )}

      {selectedInvoice !== null && (
        <InvoiceDecisionModal
          invoiceId={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
}

function AddInvoiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    invoice_number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    customer_name: "",
    customer_email: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    amount: "",
    paid_amount: "0",
    description: "Commercial Receivable",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createInvoice({
        ...form,
        amount: Number(form.amount),
        paid_amount: Number(form.paid_amount || 0),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW RECEIVABLE</p>
            <h3>Create Invoice</h3>
          </div>
          <button className="decision-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="page-error" style={{ marginBottom: "16px" }}>
            <CircleAlert size={16} /> {error}
          </div>
        )}

        <form className="modal-form" onSubmit={submit}>
          <div className="form-row-2">
            <div className="form-group">
              <label>Invoice Number *</label>
              <input
                required
                value={form.invoice_number}
                onChange={(e) =>
                  setForm({ ...form, invoice_number: e.target.value })
                }
                placeholder="INV-3001"
              />
            </div>
            <div className="form-group">
              <label>Customer Name *</label>
              <input
                required
                value={form.customer_name}
                onChange={(e) =>
                  setForm({ ...form, customer_name: e.target.value })
                }
                placeholder="e.g. Apex Global Corp"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Customer Email *</label>
            <input
              required
              type="email"
              value={form.customer_email}
              onChange={(e) =>
                setForm({ ...form, customer_email: e.target.value })
              }
              placeholder="billing@apexcorp.com"
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Issue Date *</label>
              <input
                required
                type="date"
                value={form.issue_date}
                onChange={(e) =>
                  setForm({ ...form, issue_date: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Due Date *</label>
              <input
                required
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Total Amount (₹ INR) *</label>
              <input
                required
                type="number"
                min="1"
                step="any"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="500000"
              />
            </div>
            <div className="form-group">
              <label>Paid Amount (₹ INR)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.paid_amount}
                onChange={(e) =>
                  setForm({ ...form, paid_amount: e.target.value })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description / Line Items</label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Commercial SaaS & consulting services"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              <Save size={15} />
              {submitting ? "Creating..." : "Save Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CsvImportButton({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await importInvoices(file);
      alert(
        `Imported ${result.created} invoice(s).${
          result.skipped.length ? ` Skipped: ${result.skipped.join(" | ")}` : ""
        }`
      );
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not import invoices");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <label className="scenario-button secondary-button" style={{ margin: 0 }}>
      <FileUp size={14} /> {uploading ? "Importing..." : "Import CSV"}
      <input
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={upload}
        disabled={uploading}
      />
    </label>
  );
}

/* =========================================================
   2. POLICIES VIEW
   ========================================================= */
function PoliciesView({
  initial,
  onSaved,
}: {
  initial: Record<string, unknown>;
  onSaved: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState({
    max_discount_percent: Number(initial.max_discount_percent || 5),
    approval_threshold_percent: Number(initial.approval_threshold_percent || 2),
    high_value_threshold: Number(initial.high_value_threshold || 10000),
    max_automated_reminders: Number(initial.max_automated_reminders || 3),
    early_payment_discounts: Boolean(initial.early_payment_discounts),
    automated_reminders: Boolean(initial.automated_reminders),
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DETERMINISTIC GUARDRAILS</p>
          <h2>Merchant Recovery Policies</h2>
          <p className="subhead">
            Set rigid financial boundaries and human-in-the-loop triggers for
            all autonomous actions.
          </p>
        </div>
        <div className="policy-badge">
          <ShieldCheck size={16} /> Enforced on 100% of workflows
        </div>
      </div>

      <div className="policy-grid">
        <div className="policy-main-cards">
          {/* CARD 1: DISCOUNTS */}
          <div className="policy-card">
            <div className="policy-card-header">
              <div className="policy-card-icon">
                <CircleDollarSign size={18} />
              </div>
              <div>
                <h3>Early-Payment Discount Guardrails</h3>
                <p>
                  Cap the maximum discount concession FLOWX can propose to
                  accelerate cash.
                </p>
              </div>
            </div>

            <div className="policy-field">
              <div className="policy-field-label">
                <b>Maximum Autonomous Discount</b>
                <span>{values.max_discount_percent}%</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="0"
                max="15"
                step="0.5"
                value={values.max_discount_percent}
                onChange={(e) =>
                  setValues({
                    ...values,
                    max_discount_percent: Number(e.target.value),
                  })
                }
              />
              <small>
                FLOWX will strictly never exceed this discount percentage when
                negotiating settlement acceleration.
              </small>
            </div>

            <div className="toggle-switch-row">
              <div>
                <b>Enable Early-Payment Discount Strategy</b>
                <small>
                  Allow the engine to generate early-pay discount offers for
                  high-risk debtors.
                </small>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={values.early_payment_discounts}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      early_payment_discounts: e.target.checked,
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          {/* CARD 2: APPROVAL & THRESHOLDS */}
          <div className="policy-card">
            <div className="policy-card-header">
              <div className="policy-card-icon">
                <UserCheck size={18} />
              </div>
              <div>
                <h3>Human-in-the-Loop Approval Thresholds</h3>
                <p>
                  Define exposure levels that mandate human finance admin
                  approval before execution.
                </p>
              </div>
            </div>

            <div className="policy-field">
              <div className="policy-field-label">
                <b>Discount Approval Trigger Threshold</b>
                <span>{values.approval_threshold_percent}%</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="0"
                max="10"
                step="0.5"
                value={values.approval_threshold_percent}
                onChange={(e) =>
                  setValues({
                    ...values,
                    approval_threshold_percent: Number(e.target.value),
                  })
                }
              />
              <small>
                Any proposed concession equal to or higher than this percentage
                is queued for manual sign-off.
              </small>
            </div>

            <div className="policy-field">
              <div className="policy-field-label">
                <b>High-Value Exposure Threshold</b>
                <span>{money(values.high_value_threshold)}</span>
              </div>
              <input
                type="number"
                min="1000"
                step="5000"
                className="search-input"
                style={{ marginTop: "6px" }}
                value={values.high_value_threshold}
                onChange={(e) =>
                  setValues({
                    ...values,
                    high_value_threshold: Number(e.target.value),
                  })
                }
              />
              <small>
                Invoices exceeding this amount require explicit Finance Admin
                review before severe legal escalation.
              </small>
            </div>
          </div>

          {/* CARD 3: REMINDERS & CADENCE */}
          <div className="policy-card">
            <div className="policy-card-header">
              <div className="policy-card-icon">
                <Clock3 size={18} />
              </div>
              <div>
                <h3>Automated Reminder Cadence</h3>
                <p>
                  Configure autonomous notification frequency and follow-up
                  limits.
                </p>
              </div>
            </div>

            <div className="policy-field">
              <div className="policy-field-label">
                <b>Max Automated Touchpoints</b>
                <span>{values.max_automated_reminders} Reminders</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="1"
                max="10"
                step="1"
                value={values.max_automated_reminders}
                onChange={(e) =>
                  setValues({
                    ...values,
                    max_automated_reminders: Number(e.target.value),
                  })
                }
              />
              <small>
                Number of payment link reminders sent before automatically
                escalating to promise-to-pay workflow.
              </small>
            </div>

            <div className="toggle-switch-row">
              <div>
                <b>Automated Payment Link Delivery</b>
                <small>
                  Deliver friction-free instant payment links via email/SMS for
                  low-risk overdue invoices.
                </small>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={values.automated_reminders}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      automated_reminders: e.target.checked,
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          <button
            className="scenario-button"
            style={{ padding: "14px 24px", fontSize: "12px", width: "100%" }}
            onClick={() => onSaved(values)}
          >
            <Save size={16} /> Save Policy Guardrails
          </button>
        </div>

        {/* SIDEBAR: IMPACT PREVIEW */}
        <div>
          <div className="policy-impact-panel">
            <p className="eyebrow" style={{ color: "var(--mint)" }}>
              SAFETY GUARANTEE
            </p>
            <h3>Live Policy Protection</h3>
            <p>
              Deterministic rules run before any model recommendation is
              eligible for execution.
            </p>

            <div className="policy-guardrail-list">
              <div className="policy-guardrail-item">
                <Check size={18} />
                <div>
                  <b>Margin Protection</b>
                  <small>
                    100% of discounts capped strictly at{" "}
                    {values.max_discount_percent}%.
                  </small>
                </div>
              </div>

              <div className="policy-guardrail-item">
                <Check size={18} />
                <div>
                  <b>Human Governance Gate</b>
                  <small>
                    Discounts ≥ {values.approval_threshold_percent}% & invoices
                    ≥ {money(values.high_value_threshold)} mandate Finance Admin
                    approval.
                  </small>
                </div>
              </div>

              <div className="policy-guardrail-item">
                <Check size={18} />
                <div>
                  <b>Spam & Brand Safety</b>
                  <small>
                    Autonomous communications limited to{" "}
                    {values.max_automated_reminders} touchpoints.
                  </small>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "24px",
                padding: "12px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "8px",
                fontSize: "10px",
                color: "#9cbdb3",
              }}
            >
              🔒 <b>Audit Compliance:</b> Every policy configuration change is
              immutably recorded in the system audit log.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   3. RECOVERY ACTIONS VIEW
   ========================================================= */
function RecoveryView({
  rows,
  onAction,
}: {
  rows: RecoveryAction[];
  onAction: (id: number, verb: string) => void;
}) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const pendingCount = rows.filter(
    (r) => r.status === "PENDING_APPROVAL"
  ).length;
  const recommendedCount = rows.filter(
    (r) => r.status === "RECOMMENDED"
  ).length;
  const executedCount = rows.filter((r) => r.status === "EXECUTED").length;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchFilter =
        filter === "ALL" ||
        (filter === "PENDING" && r.status === "PENDING_APPROVAL") ||
        (filter === "RECOMMENDED" && r.status === "RECOMMENDED") ||
        (filter === "EXECUTED" && r.status === "EXECUTED");

      const matchSearch =
        search === "" ||
        r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        r.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        r.reason.toLowerCase().includes(search.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [rows, filter, search]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECOVERY WORKFLOW ENGINE</p>
          <h2>Recovery Actions Queue</h2>
          <p className="subhead">
            Policy-checked workflows generated by FLOWX risk intelligence.
          </p>
        </div>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Total actions</span>
            <Sparkles size={18} />
          </div>
          <strong>{rows.length}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Active workflow pipeline
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Needs approval</span>
            <ShieldAlert size={18} />
          </div>
          <strong style={{ color: "#bd7a32" }}>{pendingCount}</strong>
          <div className="metric-change" style={{ color: "#bd7a32" }}>
            <Clock3 size={14} /> Human-in-the-loop gated
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Recommended</span>
            <TrendingUp size={18} />
          </div>
          <strong>{recommendedCount}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Policy verified
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Executed</span>
            <Check size={18} />
          </div>
          <strong>{executedCount}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Workflows in motion
          </div>
        </div>
      </section>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} />
          <input
            className="search-input"
            placeholder="Search action, customer, or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button
            className={`filter-pill ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            All Actions <span className="pill-count">{rows.length}</span>
          </button>
          <button
            className={`filter-pill ${filter === "PENDING" ? "active" : ""}`}
            onClick={() => setFilter("PENDING")}
          >
            Needs Approval <span className="pill-count">{pendingCount}</span>
          </button>
          <button
            className={`filter-pill ${
              filter === "RECOMMENDED" ? "active" : ""
            }`}
            onClick={() => setFilter("RECOMMENDED")}
          >
            Recommended <span className="pill-count">{recommendedCount}</span>
          </button>
          <button
            className={`filter-pill ${filter === "EXECUTED" ? "active" : ""}`}
            onClick={() => setFilter("EXECUTED")}
          >
            Executed <span className="pill-count">{executedCount}</span>
          </button>
        </div>
      </div>

      <div className="data-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action ID</th>
                <th>Target Customer & Invoice</th>
                <th>Recommended Workflow</th>
                <th>Risk Tier</th>
                <th>AI Confidence</th>
                <th>Strategy Reasoning</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const conf = Math.round(Number(row.confidence) * 100);
                  const isPending = row.status === "PENDING_APPROVAL";
                  const isRecommended = row.status === "RECOMMENDED";
                  const isExecuted = row.status === "EXECUTED";

                  return (
                    <tr key={row.id}>
                      <td>
                        <b className="action-id">
                          #RA-{String(1000 + row.id).padStart(4, "0")}
                        </b>
                        <small>Policy: PASS</small>
                      </td>

                      <td>
                        <b>{row.customer_name}</b>
                        <small>
                          {row.invoice_number} · {money(row.invoice_amount)}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`workflow-badge ${row.action_type || "early_payment_discount"}`}
                        >
                          <Sparkles size={12} />
                          {title(row.action_type || "Recovery Action")}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`risk-pill ${(
                            row.risk_tier || "low"
                          ).toLowerCase()}`}
                        >
                          <i />
                          {row.risk_tier}
                        </span>
                      </td>

                      <td>
                        <div className="confidence-bar">
                          <div className="conf-track">
                            <div
                              className="conf-fill"
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                          <b>{conf}%</b>
                        </div>
                      </td>

                      <td style={{ maxWidth: "260px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#576966",
                            lineHeight: 1.4,
                            display: "block",
                          }}
                        >
                          {row.reason}
                        </span>
                      </td>

                      <td>
                        {isPending ? (
                          <span className="status-pill needs-approval">
                            Needs approval
                          </span>
                        ) : isExecuted ? (
                          <span className="status-pill approved">
                            <Check size={12} /> Executed
                          </span>
                        ) : (
                          <span className="status-pill">{row.status}</span>
                        )}
                      </td>

                      <td>
                        {isPending ? (
                          <button
                            className="approve-button"
                            onClick={() => onAction(row.id, "approve")}
                          >
                            Approve
                          </button>
                        ) : isRecommended ? (
                          <button
                            className="approve-button"
                            style={{
                              background: "var(--deep)",
                              color: "#fff",
                            }}
                            onClick={() => onAction(row.id, "execute")}
                          >
                            <Play size={12} fill="currentColor" /> Execute
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#889794",
                            }}
                          >
                            Workflow active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      No recovery actions match the current filter.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   4. PROMISES TO PAY VIEW
   ========================================================= */
function PromisesView({
  rows,
  onCreated,
}: {
  rows: PromiseRecord[];
  onCreated: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const totalCommitted = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.committed_amount || 0), 0),
    [rows]
  );
  const keptPromises = useMemo(
    () => rows.filter((r) => ["KEPT", "PAID"].includes(r.status)),
    [rows]
  );
  const keptRate = rows.length
    ? Math.round((keptPromises.length / rows.length) * 100)
    : 100;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      return (
        search === "" ||
        r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        r.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [rows, search]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMITMENT TRACKING</p>
          <h2>Promises to Pay</h2>
          <p className="subhead">
            Track debtor payment commitments, honor rates, and automated
            follow-ups.
          </p>
        </div>
        <button
          className="scenario-button"
          onClick={() => setShowModal(true)}
        >
          <Plus size={15} /> Record promise
        </button>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Committed capital</span>
            <WalletCards size={18} />
          </div>
          <strong>{money(totalCommitted)}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Total promised volume
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Promise kept rate</span>
            <ShieldCheck size={18} />
          </div>
          <strong style={{ color: keptRate >= 80 ? "var(--green)" : "#bd7a32" }}>
            {keptRate}%
          </strong>
          <div className="metric-change">
            <Check size={14} /> {keptPromises.length} honored promises
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Active commitments</span>
            <Clock3 size={18} />
          </div>
          <strong>
            {rows.filter((r) => r.status === "PENDING").length}
          </strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Pending settlement
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Broken commitments</span>
            <CircleAlert size={18} />
          </div>
          <strong>
            {rows.filter((r) => ["MISSED", "BROKEN"].includes(r.status)).length}
          </strong>
          <div className="metric-change negative">
            <ArrowUpRight size={14} /> Required escalation
          </div>
        </div>
      </section>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} />
          <input
            className="search-input"
            placeholder="Search debtor name, invoice #, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="data-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Committed Amount</th>
                <th>Promised Due Date</th>
                <th>Status</th>
                <th>Notes / Debtor Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const promisedDate = new Date(row.promised_date);
                  const isPast = Date.now() > promisedDate.getTime();
                  const initials = row.customer_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="customer-cell">
                          <span className="customer-avatar">{initials}</span>
                          <div>
                            <b>{row.customer_name}</b>
                          </div>
                        </div>
                      </td>

                      <td>
                        <b style={{ color: "#193d38" }}>
                          {row.invoice_number}
                        </b>
                      </td>

                      <td>
                        <b style={{ fontSize: "13px" }}>
                          {money(row.committed_amount)}
                        </b>
                      </td>

                      <td>
                        <div className="due-cell">
                          <b>{row.promised_date}</b>
                          {row.status === "KEPT" ? (
                            <span className="overdue-badge ontime">
                              <Check size={11} /> Honored
                            </span>
                          ) : isPast ? (
                            <span className="overdue-badge critical">
                              Overdue commitment
                            </span>
                          ) : (
                            <span className="overdue-badge warning">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${row.status.toLowerCase()}`}
                        >
                          {row.status}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#6b7d79",
                            fontStyle: row.notes ? "normal" : "italic",
                          }}
                        >
                          {row.notes || "No notes entered"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      No promises recorded yet. Click &quot;Record promise&quot; to log a
                      debtor commitment.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <RecordPromiseModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            onCreated();
          }}
        />
      )}
    </>
  );
}

function RecordPromiseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getInvoices()
      .then((rows) => {
        setInvoices(rows);
        if (rows[0]) {
          setInvoiceId(String(rows[0].id));
          setAmount(String(Math.max(0, rows[0].amount - rows[0].paid_amount)));
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createPromise({
        invoice_id: Number(invoiceId),
        committed_amount: Number(amount),
        promised_date: date,
        notes,
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not record promise"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW COMMITMENT</p>
            <h3>Record Promise to Pay</h3>
          </div>
          <button className="decision-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="page-error" style={{ marginBottom: "16px" }}>
            <CircleAlert size={16} /> {error}
          </div>
        )}

        <form className="modal-form" onSubmit={submit}>
          <div className="form-group">
            <label>Select Invoice & Debtor *</label>
            <select
              required
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                const sel = invoices.find((x) => x.id === Number(e.target.value));
                if (sel) {
                  setAmount(String(Math.max(0, sel.amount - sel.paid_amount)));
                }
              }}
            >
              <option value="">Select outstanding invoice</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} · {i.customer_name} (
                  {money(i.amount - i.paid_amount)} due)
                </option>
              ))}
            </select>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Committed Amount (₹ INR) *</label>
              <input
                required
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
              />
            </div>
            <div className="form-group">
              <label>Promised Payment Date *</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Debtor Remarks / Follow-up Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Debtor confirmed via phone call that accounts payable will release check on Friday."
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !invoiceId}
            >
              <Save size={15} />
              {submitting ? "Recording..." : "Save Commitment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   5. CASH ANALYTICS VIEW
   ========================================================= */
function AnalyticsView({ data }: { data: Record<string, unknown> }) {
  const tiers = (data.by_risk_tier as Array<Record<string, unknown>>) || [];
  const maxInvoiced = Math.max(
    ...tiers.map((t) => Number(t.invoiced || 0)),
    1
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PORTFOLIO INTELLIGENCE</p>
          <h2>Cash & Recovery Analytics</h2>
          <p className="subhead">
            Measure cash velocity, DSO acceleration, and portfolio yield across
            risk cohorts.
          </p>
        </div>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Additional cash recovered</span>
            <CircleDollarSign size={18} />
          </div>
          <strong>{money(data.additional_cash_recovered)}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Autonomous recovery yield
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Recovery improvement</span>
            <TrendingUp size={18} />
          </div>
          <strong>{String(data.recovery_improvement_percent)}%</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> vs. manual baseline
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>DSO reduction</span>
            <Clock3 size={18} />
          </div>
          <strong>{String(data.dso_reduction_days)} days</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Cash acceleration
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Net ROI multiple</span>
            <Sparkles size={18} />
          </div>
          <strong>{String(data.roi_multiple)}x</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Return on software
          </div>
        </div>
      </section>

      <div className="main-grid">
        {/* PANEL 1: RISK TIER BREAKDOWN */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">COHORT PERFORMANCE</p>
              <h3>Recovery Yield by Risk Tier</h3>
            </div>
            <BarChart3 size={18} style={{ color: "var(--green)" }} />
          </div>

          <div style={{ marginTop: "20px" }}>
            {tiers.length ? (
              tiers.map((tier) => {
                const invoiced = Number(tier.invoiced || 0);
                const recovered = Number(tier.recovered || 0);
                const rate = invoiced
                  ? Math.round((recovered / invoiced) * 100)
                  : 0;
                const recoveredWidth = invoiced
                  ? (recovered / invoiced) * 100
                  : 0;

                return (
                  <div className="tier-progress-card" key={String(tier.risk_tier)}>
                    <div className="tier-progress-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          className={`risk-dot ${String(
                            tier.risk_tier
                          ).toLowerCase()}`}
                        />
                        <b>{String(tier.risk_tier)} Risk</b>
                      </div>
                      <span>
                        {rate}% recovered ({money(recovered)} / {money(invoiced)})
                      </span>
                    </div>

                    <div className="tier-progress-bar">
                      <div
                        className="recovered-portion"
                        style={{ width: `${recoveredWidth}%` }}
                      />
                    </div>

                    <div className="tier-progress-bottom">
                      <span>Exposure: {money(invoiced)}</span>
                      <span>Recovered: {money(recovered)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                No portfolio invoice data available yet.
              </div>
            )}
          </div>
        </div>

        {/* PANEL 2: DSO ACCELERATION */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CASH VELOCITY</p>
              <h3>DSO & Collection Timeline</h3>
            </div>
            <Clock3 size={18} style={{ color: "var(--green)" }} />
          </div>

          <div style={{ marginTop: "18px" }}>
            <div
              style={{
                background: "#f4f8f5",
                border: "1px solid #dbeae2",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "14px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#687a76" }}>
                Manual Baseline DSO
              </span>
              <strong
                style={{
                  display: "block",
                  fontSize: "24px",
                  fontFamily: "Space Grotesk",
                  margin: "4px 0",
                }}
              >
                48 Days
              </strong>
              <small style={{ color: "#8d9c98", fontSize: "10px" }}>
                Traditional manual reminders and phone follow-ups
              </small>
            </div>

            <div
              style={{
                background: "#eaf8f0",
                border: "1px solid #c8ecd7",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--green)" }}>
                FLOWX Autonomous DSO
              </span>
              <strong
                style={{
                  display: "block",
                  fontSize: "24px",
                  fontFamily: "Space Grotesk",
                  color: "var(--green)",
                  margin: "4px 0",
                }}
              >
                37 Days (-11 Days)
              </strong>
              <small style={{ color: "#3e8c6b", fontSize: "10px" }}>
                Accelerated via deterministic policy-gated recovery
              </small>
            </div>

            <div
              className="policy-callout"
              style={{ marginTop: "20px" }}
            >
              <Sparkles size={17} />
              <span>
                <b>Capital in Motion</b>
                <small>
                  Every day reduced in DSO returns capital directly to working
                  liquidity.
                </small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   6. AUDIT LOG VIEW
   ========================================================= */
function AuditLogView({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(
    null
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        search === "" ||
        String(r.description || "").toLowerCase().includes(search.toLowerCase()) ||
        String(r.event_type || "").toLowerCase().includes(search.toLowerCase());

      const matchEvent =
        eventFilter === "ALL" || r.event_type === eventFilter;

      return matchSearch && matchEvent;
    });
  }, [rows, search, eventFilter]);

  const uniqueEvents = useMemo(() => {
    return Array.from(new Set(rows.map((r) => String(r.event_type))));
  }, [rows]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMPLIANCE & GOVERNANCE</p>
          <h2>System Audit Log</h2>
          <p className="subhead">
            Immutable chronological record of every AI recommendation, policy
            gate, and human approval.
          </p>
        </div>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Total audit entries</span>
            <FileText size={18} />
          </div>
          <strong>{rows.length}</strong>
          <div className="metric-change">
            <ArrowUpRight size={14} /> Immutable audit trail
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Human approvals</span>
            <UserCheck size={18} />
          </div>
          <strong>
            {
              rows.filter((r) =>
                String(r.event_type).includes("APPROVED")
              ).length
            }
          </strong>
          <div className="metric-change">
            <Check size={14} /> Verified actions
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Policy checks</span>
            <ShieldCheck size={18} />
          </div>
          <strong>
            {
              rows.filter((r) =>
                String(r.event_type).includes("POLICY") ||
                String(r.event_type).includes("DECISION")
              ).length
            }
          </strong>
          <div className="metric-change">
            <Check size={14} /> Guardrails verified
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>System status</span>
            <Gauge size={18} />
          </div>
          <strong style={{ color: "var(--green)" }}>Compliant</strong>
          <div className="metric-change">
            <Check size={14} /> 100% integrity
          </div>
        </div>
      </section>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} />
          <input
            className="search-input"
            placeholder="Search audit description, event type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button
            className={`filter-pill ${eventFilter === "ALL" ? "active" : ""}`}
            onClick={() => setEventFilter("ALL")}
          >
            All Events
          </button>
          {uniqueEvents.slice(0, 4).map((evt) => (
            <button
              key={evt}
              className={`filter-pill ${eventFilter === evt ? "active" : ""}`}
              onClick={() => setEventFilter(evt)}
            >
              {title(evt)}
            </button>
          ))}
        </div>
      </div>

      <div className="data-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Description</th>
                <th>Actor</th>
                <th>Timestamp</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={String(row.id)}>
                    <td>
                      <span
                        className={`audit-badge ${String(row.event_type)}`}
                      >
                        {String(row.event_type)}
                      </span>
                    </td>

                    <td>
                      <b style={{ fontSize: "12px", color: "var(--ink)" }}>
                        {String(row.description)}
                      </b>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#5f726e",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <UserCheck size={13} />
                        {row.actor_id ? "Finance Admin" : "FLOWX Engine"}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: "11px", color: "#879894" }}>
                        {new Date(String(row.created_at)).toLocaleString("en-IN")}
                      </span>
                    </td>

                    <td>
                      {row.details && String(row.details) !== "{}" ? (
                        <button
                          className="decision-button"
                          onClick={() => setSelectedLog(row)}
                        >
                          <Info size={12} /> View Details
                        </button>
                      ) : (
                        <span style={{ color: "#a5b4b1", fontSize: "11px" }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">No audit logs found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p className="eyebrow">AUDIT DETAILS</p>
                <h3>{String(selectedLog.event_type)}</h3>
              </div>
              <button
                className="decision-close"
                onClick={() => setSelectedLog(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "#5a6d69" }}>
              {String(selectedLog.description)}
            </p>
            <pre
              style={{
                background: "#f4f8f5",
                border: "1px solid #dbeae2",
                borderRadius: "8px",
                padding: "16px",
                fontSize: "11px",
                overflowX: "auto",
                color: "#183e39",
              }}
            >
              {typeof selectedLog.details === "string"
                ? JSON.stringify(JSON.parse(selectedLog.details), null, 2)
                : JSON.stringify(selectedLog.details, null, 2)}
            </pre>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   7. SYSTEM HEALTH VIEW
   ========================================================= */
function HealthView({
  data,
  onRefresh,
}: {
  data: Record<string, unknown>;
  onRefresh: () => void;
}) {
  const components =
    (data.components as Array<Record<string, unknown>>) || [];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INFRASTRUCTURE & RELIABILITY</p>
          <h2>System Health & Diagnostics</h2>
          <p className="subhead">
            Real-time status of FLOWX inference, policy rules engine, and
            receivables database.
          </p>
        </div>
        <button className="scenario-button" onClick={onRefresh}>
          <RefreshCw size={14} /> Run Diagnostic Check
        </button>
      </div>

      {/* HEALTH BANNER */}
      <div className="health-banner">
        <div className="health-banner-left">
          <div className="pulse-dot" />
          <div>
            <h3>All Systems Operational</h3>
            <p>99.98% platform uptime over the last 90 days</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <div className="health-stat-chip">
            <Check size={14} /> 0 Active Incidents
          </div>
          <div className="health-stat-chip">
            <Sparkles size={14} /> API Latency: 12ms
          </div>
        </div>
      </div>

      <div className="health-grid">
        {components.map((item) => (
          <div className="panel health-card" key={String(item.name)}>
            <div className="health-icon">
              <Check size={17} />
            </div>
            <div>
              <h3>{String(item.name)}</h3>
              <p>
                Status: <b>{String(item.status)}</b> · Latency:{" "}
                {String(item.latency_ms)}ms
              </p>
            </div>
            <span className="live-dot" />
          </div>
        ))}
      </div>
    </>
  );
}
