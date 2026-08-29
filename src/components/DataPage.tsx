"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CircleAlert, FileUp, LoaderCircle, Play, Save, Sparkles } from "lucide-react";
import { approveAction, createInvoice, createPromise, executeAction, getAnalytics, getAuditLogs, getHealth, getInvoices, getPolicy, getPromises, getRecoveryActions, importInvoices, updatePolicy, Invoice } from "@/lib/api";
import AppShell from "@/components/AppShell";
import InvoiceDecisionModal from "@/components/InvoiceDecisionModal";
const money = (value: unknown) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const title = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type Kind = "invoices" | "recovery" | "promises" | "analytics" | "audit" | "policies" | "health";

export default function DataPage({ kind }: { kind: Kind }) {
  const [data, setData] = useState<unknown>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [invoiceRefresh, setInvoiceRefresh] = useState(0);
  useEffect(() => { load(); }, [kind, invoiceRefresh]);
  async function load() { setError(""); try { setData(kind === "invoices" ? await getInvoices() : kind === "recovery" ? await getRecoveryActions() : kind === "promises" ? await getPromises() : kind === "analytics" ? await getAnalytics() : kind === "audit" ? await getAuditLogs() : kind === "policies" ? await getPolicy() : await getHealth()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load this page"); } }
  async function action(fn: () => Promise<unknown>, success: string) { setBusy(true); try { await fn(); setMessage(success); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed"); } finally { setBusy(false); } }
  const heading = kind === "health" ? "System health" : kind === "audit" ? "Audit log" : kind === "policies" ? "Merchant policies" : title(kind);
  return <AppShell><div className="page-heading"><div><p className="eyebrow">FLOWX WORKSPACE</p><h2>{heading}</h2><p className="subhead">Live data from your merchant workspace.</p></div>{kind === "invoices" && <InvoiceActions onDone={() => { setMessage("Invoice added successfully"); setInvoiceRefresh((v) => v + 1); }} />}{kind === "promises" && <PromiseForm onCreated={() => action(load, "Promise recorded")} />}</div>{message && <div className="toast inline-toast"><Check size={16} />{message}</div>}{error && <div className="page-error"><CircleAlert size={17} />{error}</div>}{busy && <div className="loading"><LoaderCircle className="spin" size={17} /> Syncing with FLOWX API...</div>}{data === null && !error && <div className="loading">Loading workspace data...</div>}{data !== null && kind === "invoices" && <InvoiceTable rows={data as Invoice[]} />}{data !== null && kind === "recovery" && <RecoveryTable rows={data as Array<Record<string, unknown>>} onAction={(id, verb) => action(() => verb === "approve" ? approveAction(id) : executeAction(id), `${verb} request completed`)} />}{data !== null && kind === "promises" && <PromiseTable rows={data as Array<Record<string, unknown>>} />}{data !== null && kind === "analytics" && <Analytics data={data as Record<string, unknown>} />}{data !== null && kind === "audit" && <AuditTable rows={data as Array<Record<string, unknown>>} />}{data !== null && kind === "policies" && <PolicyForm initial={data as Record<string, unknown>} onSaved={(payload) => action(() => updatePolicy(payload), "Policy guardrails saved")} />}{data !== null && kind === "health" && <Health data={data as Record<string, unknown>} />}</AppShell>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="panel data-panel"><div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div></div>; }

function InvoiceTable({ rows }: { rows: Invoice[] }) {
  const [selectedInvoice, setSelectedInvoice] =
    useState<number | null>(null);

  return (
    <>
      <Table
        headers={[
          "Invoice",
          "Customer",
          "Amount",
          "Paid",
          "Due date",
          "Risk",
          "Status",
          "AI decision",
        ]}
      >
        {rows.length ? (
          rows.map((row) => (
            <tr key={row.id}>

              <td>
                <b>{row.invoice_number}</b>
                <small>{row.description}</small>
              </td>

              <td>
                {row.customer_name}
                <small>{row.customer_email}</small>
              </td>

              <td>
                <b>{money(row.amount)}</b>
              </td>

              <td>
                {money(row.paid_amount)}
              </td>

              <td>
                {row.due_date}
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
                {row.status}
              </td>

              <td>
                <button
                  className="decision-button"
                  onClick={() =>
                    setSelectedInvoice(row.id)
                  }
                >
                  <Sparkles size={13} />
                  Analyze
                </button>
              </td>

            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8}>
              <div className="empty-state">
                No invoices yet. Add one above
                or import a CSV.
              </div>
            </td>
          </tr>
        )}
      </Table>

      {selectedInvoice !== null && (
        <InvoiceDecisionModal
          invoiceId={selectedInvoice}
          onClose={() =>
            setSelectedInvoice(null)
          }
        />
      )}
    </>
  );
}



function RecoveryTable({ rows, onAction }: { rows: Array<Record<string, unknown>>; onAction: (id: number, verb: string) => void }) { return <Table headers={["Action", "Customer / invoice", "Risk", "Confidence", "Reason", "Status", ""]}>{rows.length ? rows.map((row) => <tr key={String(row.id)}><td><b>RA-{String(row.id).padStart(4, "0")}</b><small>{title(String(row.action_type))}</small></td><td><b>{String(row.customer_name)}</b><small>{String(row.invoice_number)} · {money(row.invoice_amount)}</small></td><td><span className={`risk-pill ${String(row.risk_tier).toLowerCase()}`}><i />{String(row.risk_tier)}</span></td><td>{Math.round(Number(row.confidence) * 100)}%</td><td>{String(row.reason)}</td><td>{String(row.status)}</td><td>{["APPROVED", "RECOMMENDED"].includes(String(row.status)) ? <button className="approve-button" onClick={() => onAction(Number(row.id), String(row.status) === "APPROVED" ? "execute" : "execute")}><Play size={12} /> Execute</button> : String(row.status) === "PENDING_APPROVAL" ? <button className="approve-button" onClick={() => onAction(Number(row.id), "approve")}>Approve</button> : <span className="status-pill approved">Done</span>}</td></tr>) : <tr><td colSpan={7}><div className="empty-state">No recovery actions yet. Add invoices to generate risk-based actions.</div></td></tr>}</Table>; }
function PromiseTable({ rows }: { rows: Array<Record<string, unknown>> }) { return <Table headers={["Customer", "Invoice", "Committed", "Promised date", "Status", "Notes"]}>{rows.length ? rows.map((row) => <tr key={String(row.id)}><td><b>{String(row.customer_name)}</b></td><td>{String(row.invoice_number)}</td><td>{money(row.committed_amount)}</td><td>{String(row.promised_date)}</td><td><span className="status-pill approved">{String(row.status)}</span></td><td>{String(row.notes || "-")}</td></tr>) : <tr><td colSpan={6}><div className="empty-state">No promises recorded yet.</div></td></tr>}</Table>; }
function Analytics({ data }: { data: Record<string, unknown> }) { return <><div className="metrics-grid"><Metric label="Additional cash recovered" value={money(data.additional_cash_recovered)} /><Metric label="Recovery improvement" value={`${data.recovery_improvement_percent}%`} /><Metric label="DSO reduction" value={`${data.dso_reduction_days} days`} /><Metric label="ROI multiple" value={`${data.roi_multiple}x`} /></div><div className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">PORTFOLIO PERFORMANCE</p><h3>Recovery by risk tier</h3></div></div><Table headers={["Risk tier", "Invoiced exposure", "Recovered", "Recovery rate"]}>{(data.by_risk_tier as Array<Record<string, unknown>>).length ? (data.by_risk_tier as Array<Record<string, unknown>>).map((row) => <tr key={String(row.risk_tier)}><td><b>{String(row.risk_tier)}</b></td><td>{money(row.invoiced)}</td><td>{money(row.recovered)}</td><td>{Number(row.invoiced) ? `${Math.round(Number(row.recovered) / Number(row.invoiced) * 100)}%` : "0%"}</td></tr>) : <tr><td colSpan={4}><div className="empty-state">No invoice data yet. Add or import invoices first.</div></td></tr>}</Table></div></>; }
function AuditTable({ rows }: { rows: Array<Record<string, unknown>> }) { return <Table headers={["Event", "Description", "Actor", "Timestamp"]}>{rows.map((row) => <tr key={String(row.id)}><td><b>{title(String(row.event_type))}</b></td><td>{String(row.description)}</td><td>{String(row.actor_id || "System")}</td><td>{new Date(String(row.created_at)).toLocaleString("en-IN")}</td></tr>)}</Table>; }
function Health({ data }: { data: Record<string, unknown> }) { return <div className="health-grid">{(data.components as Array<Record<string, unknown>>).map((item) => <div className="panel health-card" key={String(item.name)}><div className="health-icon"><Check size={17} /></div><div><h3>{String(item.name)}</h3><p>{String(item.status)} · {String(item.latency_ms)}ms</p></div><span className="live-dot" /></div>)}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><Sparkles size={18} /></div><strong>{value}</strong><div className="metric-change"><ArrowUpRight size={14} /> Live API value</div></div>; }

function InvoiceActions({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false); const [uploading, setUploading] = useState(false); const [form, setForm] = useState({ invoice_number: "", customer_name: "", customer_email: "", issue_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), amount: "", paid_amount: "0", description: "Receivable" });
  async function submit(event: React.FormEvent) { event.preventDefault(); setUploading(true); try { await createInvoice({ ...form, amount: Number(form.amount), paid_amount: Number(form.paid_amount) }); setForm({ ...form, invoice_number: "", customer_name: "", customer_email: "", amount: "", paid_amount: "0" }); setOpen(false); onDone(); } catch (e) { alert(e instanceof Error ? e.message : "Could not create invoice"); } finally { setUploading(false); } }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const result = await importInvoices(file); alert(`Imported ${result.created} invoice(s).${result.skipped.length ? ` Skipped: ${result.skipped.join(" | ")}` : ""}`); onDone(); } catch (e) { alert(e instanceof Error ? e.message : "Could not import invoices"); } finally { setUploading(false); event.target.value = ""; } }
  return <div className="invoice-actions"><button className="scenario-button" onClick={() => setOpen(!open)}><Save size={14} /> Add invoice</button><label className="scenario-button secondary-button"><FileUp size={14} /> Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={upload} disabled={uploading} /></label>{open && <form className="invoice-form panel" onSubmit={submit}><div><label>Invoice number<input required value={form.invoice_number} onChange={e => setForm({...form, invoice_number:e.target.value})} placeholder="INV-3001" /></label><label>Customer<input required value={form.customer_name} onChange={e => setForm({...form, customer_name:e.target.value})} placeholder="Acme Industries" /></label><label>Customer email<input required type="email" value={form.customer_email} onChange={e => setForm({...form, customer_email:e.target.value})} placeholder="accounts@acme.com" /></label></div><div><label>Issue date<input required type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date:e.target.value})} /></label><label>Due date<input required type="date" value={form.due_date} onChange={e => setForm({...form, due_date:e.target.value})} /></label><label>Amount (INR)<input required type="number" min="1" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} placeholder="500000" /></label></div><div><label>Paid amount<input type="number" min="0" value={form.paid_amount} onChange={e => setForm({...form, paid_amount:e.target.value})} /></label><label>Description<input value={form.description} onChange={e => setForm({...form, description:e.target.value})} /></label><button className="auth-submit" disabled={uploading}>{uploading ? "Saving..." : "Create invoice"}</button></div></form>}</div>;
}

function PromiseForm({ onCreated }: { onCreated: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]); const [invoice, setInvoice] = useState(""); const [amount, setAmount] = useState(""); const [date, setDate] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState("");
  useEffect(() => { getInvoices().then(rows => { setInvoices(rows); if (rows[0]) { setInvoice(String(rows[0].id)); setAmount(String(Math.max(0, rows[0].amount - rows[0].paid_amount))); } }).catch(e => setError(e.message)); }, []);
  return <form className="inline-form" onSubmit={(event) => { event.preventDefault(); setError(""); createPromise({ invoice_id: Number(invoice), committed_amount: Number(amount), promised_date: date, notes }).then(onCreated).catch(e => setError(e.message)); }}><select value={invoice} onChange={e => { setInvoice(e.target.value); const selected=invoices.find(x=>x.id===Number(e.target.value)); if(selected) setAmount(String(Math.max(0, selected.amount-selected.paid_amount))); }} required><option value="">Select invoice</option>{invoices.map(i=><option key={i.id} value={i.id}>{i.invoice_number} · {i.customer_name}</option>)}</select><input value={amount} onChange={event => setAmount(event.target.value)} placeholder="Amount" type="number" min="1" required /><input value={date} onChange={event => setDate(event.target.value)} type="date" required /><button className="scenario-button" disabled={!invoice}><Save size={14} /> Record promise</button>{error && <small className="form-error">{error}</small>}</form>;
}
function PolicyForm({ initial, onSaved }: { initial: Record<string, unknown>; onSaved: (payload: Record<string, unknown>) => void }) { const [values, setValues] = useState({ max_discount_percent: Number(initial.max_discount_percent), approval_threshold_percent: Number(initial.approval_threshold_percent), high_value_threshold: Number(initial.high_value_threshold), max_automated_reminders: Number(initial.max_automated_reminders), early_payment_discounts: Boolean(initial.early_payment_discounts), automated_reminders: Boolean(initial.automated_reminders) }); return <div className="panel policy-form"><div className="panel-heading"><div><p className="eyebrow">DETERMINISTIC GUARDRAILS</p><h3>Merchant policy</h3></div><ShieldBadge /></div>{Object.entries(values).map(([key, value]) => typeof value === "boolean" ? <label className="toggle-label" key={key}>{title(key)}<input type="checkbox" checked={value} onChange={(event) => setValues({ ...values, [key]: event.target.checked })} /></label> : <label key={key}>{title(key)}<input type="number" value={value} onChange={(event) => setValues({ ...values, [key]: Number(event.target.value) })} /></label>)}<button className="scenario-button" onClick={() => onSaved(values)}><Save size={15} /> Save guardrails</button></div>; }
function ShieldBadge() { return <div className="policy-badge"><Check size={15} /> Enforced on every action</div>; }
