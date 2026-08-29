"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Bell, Check, ChevronDown, CircleDollarSign, Clock3, FileText, Gauge, LayoutDashboard, LifeBuoy, LogOut, MoreHorizontal, Play, ReceiptText, ShieldCheck, Sparkles, WalletCards, X } from "lucide-react";
import { approveAction, getDashboard, logout, runDemo } from "@/lib/api";

const navItems = [
  { label: "Overview", href: "/", icon: LayoutDashboard, active: true },
  { label: "Invoices & risk", href: "/invoices", icon: ReceiptText },
  { label: "Recovery actions", href: "/recovery", icon: Sparkles, count: "4" },
  { label: "Promises to pay", href: "/promises", icon: WalletCards },
  { label: "Cash analytics", href: "/analytics", icon: BarChart3 },
  { label: "Cash intelligence", href: "/intelligence", icon: Sparkles },
];
const systemItems = [
  { label: "Audit log", href: "/audit-log", icon: FileText },
  { label: "Policies", href: "/settings/policies", icon: ShieldCheck },
  { label: "System health", href: "/system-health", icon: Gauge },
];
const actions = [
  { id: "#RA-1042", customer: "Northstar Labs", invoice: "INV-2841", amount: "$18,420", risk: "Critical", detail: "48 days overdue", status: "Needs approval", tone: "critical" },
  { id: "#RA-1038", customer: "Morrow & Co.", invoice: "INV-2819", amount: "$9,800", risk: "High", detail: "22 days overdue", status: "Recommended", tone: "high" },
  { id: "#RA-1036", customer: "Pinecone Health", invoice: "INV-2807", amount: "$6,240", risk: "Medium", detail: "11 days overdue", status: "Recommended", tone: "medium" },
  { id: "#RA-1031", customer: "Kite Systems", invoice: "INV-2794", amount: "$3,900", risk: "Low", detail: "5 days overdue", status: "Executing", tone: "low" },
];
const bars = [58, 74, 68, 81, 77, 94, 88, 100, 92, 108, 102, 122];

export default function Home() {
  const [approved, setApproved] = useState<string[]>([]);
  const [dashboardActions, setDashboardActions] = useState(actions);
  const [metrics, setMetrics] = useState({ total_receivables: 248680, cash_recovered: 86420, at_risk: 42160, promise_kept_rate: 84.6 });
  const [riskDistribution, setRiskDistribution] = useState<Array<{ risk_tier: string; exposure: number; count: number }>>([]);
  const [recoveryTrend, setRecoveryTrend] = useState<Array<{ month: string; flowx: number; baseline: number }>>([]);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState({ full_name: "Jordan Davis", merchant_name: "Acme Receivables" });
  const [todayLabel, setTodayLabel] = useState("August 2024");
  useEffect(() => {
    if (!localStorage.getItem("flowx_token")) window.location.replace("/login");
    const raw = localStorage.getItem("flowx_user");
    if (raw) { try { const parsed = JSON.parse(raw); setUser(parsed); } catch {} }
    setTodayLabel(new Intl.DateTimeFormat("en-IN", { month: "short", day: "2-digit", year: "numeric" }).format(new Date()));
  }, []);
  useEffect(() => {
    getDashboard().then((data) => {
      setMetrics(data.metrics);
      setRiskDistribution(data.risk_distribution);
      setRecoveryTrend(data.recovery_trend);
      setDashboardActions(data.actions.map((action) => ({ id: `#RA-${String(1100 + action.id).slice(-4)}`, backendId: action.id, customer: action.customer_name, invoice: action.invoice_number, amount: `₹${Math.round(action.invoice_amount).toLocaleString("en-IN")}`, risk: action.risk_tier, detail: `${Math.max(0, Math.floor((Date.now() - new Date(action.due_date).getTime()) / 86400000))} days overdue`, status: action.status === "PENDING_APPROVAL" ? "Needs approval" : action.status[0] + action.status.slice(1).toLowerCase(), tone: action.risk_tier.toLowerCase() })) as typeof actions);
    }).catch(() => setNotice("API unavailable. Showing the last known workspace snapshot."));
  }, [refreshKey]);
  function runScenario() {
    setScenarioRunning(true); setNotice("Demo scenario running: evaluating policy guardrails...");
    runDemo().then(() => { setNotice("Scenario complete: 1 action queued for approval."); setRefreshKey((value) => value + 1); }).catch(() => setNotice("Could not reach the FLOWX API.")).finally(() => setScenarioRunning(false));
  }
  const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
  const chartMax = Math.max(...recoveryTrend.map((item) => item.flowx), 1);
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">F</span><span>FLOWX</span></div>
        <div className="tenant-switcher"><span className="tenant-dot">AR</span><span><b>{user.merchant_name}</b><small>Merchant workspace</small></span><ChevronDown size={15} /></div>
        <nav className="nav-group"><p className="nav-label">WORKSPACE</p>{navItems.map(({ label, href, icon: Icon, active, count }) => <Link className={`nav-item ${active ? "active" : ""}`} href={href} key={label}><Icon size={17} /><span>{label}</span>{count && <em>{count}</em>}</Link>)}</nav>
        <nav className="nav-group lower-nav"><p className="nav-label">CONTROL CENTER</p>{systemItems.map(({ label, href, icon: Icon }) => <Link className="nav-item" href={href} key={label}><Icon size={17} /><span>{label}</span></Link>)}</nav>
        <div className="sidebar-bottom"><div className="help-row"><LifeBuoy size={16} /><span>Help center</span></div><div className="profile"><span className="avatar">JD</span><span><b>{user.full_name}</b><small>Finance admin</small></span><MoreHorizontal size={17} /></div></div>
      </aside>
      <section className="workspace">
        <header className="topbar"><div><p className="breadcrumb">Workspace / Overview</p><h1>Good morning, {user.full_name.split(" ")[0]} <span>✦</span></h1></div><div className="top-actions"><div className="date-chip"><Clock3 size={15} /> {todayLabel} <ChevronDown size={14} /></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><button className="logout" onClick={() => { logout(); window.location.href = "/login"; }}><LogOut size={16} /> Log out</button></div></header>
        <div className="content">
          {notice && <div className="toast"><Check size={16} /> {notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
          <div className="hero-row"><div><p className="eyebrow">MONDAY, AUGUST 26, 2024</p><h2>Your cash, in motion.</h2><p className="subhead">One clear view of what&apos;s at risk, what&apos;s moving, and where to act next.</p></div><button className="scenario-button" onClick={runScenario} disabled={scenarioRunning}><Play size={15} fill="currentColor" /> {scenarioRunning ? "Running scenario..." : "Run demo scenario"}</button></div>
          <section className="metrics-grid"><Metric label="Total receivables" value={money(metrics.total_receivables)} change="12.4%" icon={CircleDollarSign} note="vs. last month" /><Metric label="Cash recovered" value={money(metrics.cash_recovered)} change="18.7%" icon={ArrowUpRight} note="vs. last month" /><Metric label="At risk" value={money(metrics.at_risk)} change="8.2%" icon={Bell} note="of total receivables" negative /><Metric label="Promise-kept rate" value={`${metrics.promise_kept_rate}%`} change="3.1%" icon={ShieldCheck} note="last 30 days" /></section>
          <section className="main-grid"><div className="panel recovery-panel"><div className="panel-heading"><div><p className="eyebrow">CASH PERFORMANCE</p><h3>Recovery overview</h3></div><button className="select-control">Last 12 months <ChevronDown size={14} /></button></div><div className="chart-summary"><div><span>Recovered this year</span><strong>{money(metrics.cash_recovered)}</strong><small className="positive"><ArrowUpRight size={13} /> Live from invoices</small></div><div className="legend"><span><i className="legend-flowx" /> FLOWX recovery</span><span><i className="legend-baseline" /> Manual baseline</span></div></div><div className="bar-chart">{(recoveryTrend.length ? recoveryTrend : bars.map((flowx, index) => ({ month: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"][index], flowx, baseline: flowx * .62 }))).map((item) => <div className="bar-column" key={item.month}><div className="bar-stack"><span className="baseline-bar" style={{ height: `${item.baseline / chartMax * 100}%` }} /><span className="flowx-bar" style={{ height: `${item.flowx / chartMax * 100}%` }} /></div><small>{item.month}</small></div>)}</div></div><div className="panel risk-panel"><div className="panel-heading"><div><p className="eyebrow">PORTFOLIO SIGNAL</p><h3>Risk distribution</h3></div><button className="more-button"><MoreHorizontal size={18} /></button></div><div className="risk-total"><strong>{money(metrics.at_risk)}</strong><span>exposure at risk</span></div><div className="risk-bars">{["Critical", "High", "Medium", "Low"].map((tier) => { const item = riskDistribution.find((risk) => risk.risk_tier.toLowerCase() === tier.toLowerCase()); return <RiskBar key={tier} label={tier} value={money(item?.exposure || 0)} width={`${Math.min(100, (item?.exposure || 0) / Math.max(metrics.at_risk, 1) * 100)}%`} tone={tier.toLowerCase()} />; })}</div><div className="policy-callout"><ShieldCheck size={17} /><span><b>Policy engine active</b><small>All recommendations are checked before execution.</small></span><Check size={16} className="check-icon" /></div></div></section>
          <section className="panel actions-panel"><div className="panel-heading"><div><p className="eyebrow">ACTION QUEUE</p><h3>Recovery actions <span className="count-badge">{dashboardActions.length} open</span></h3></div><button className="view-all">View all actions <ArrowUpRight size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>Action</th><th>Customer / invoice</th><th>Amount</th><th>Risk</th><th>Recommended workflow</th><th>Status</th><th /></tr></thead><tbody>{dashboardActions.map((action) => <tr key={action.id}><td><b className="action-id">{action.id}</b></td><td><b>{action.customer}</b><small>{action.invoice} · {action.detail}</small></td><td><b>{action.amount}</b></td><td><span className={`risk-pill ${action.tone}`}><i />{action.risk}</span></td><td><span className="workflow"><Sparkles size={14} /> {action.risk === "Critical" ? "Escalation + legal freeze" : action.risk === "High" ? "Early-pay discount + promise" : action.risk === "Medium" ? "Scheduled promise commitment" : "Payment link reminder"}</span></td><td>{approved.includes(action.id) ? <span className="status-pill approved"><Check size={13} /> Approved</span> : <span className={`status-pill ${action.status === "Needs approval" ? "needs-approval" : ""}`}>{action.status}</span>}</td><td>{action.status === "Needs approval" && !approved.includes(action.id) ? <button className="approve-button" onClick={() => { approveAction((action as typeof action & { backendId?: number }).backendId || 1).then(() => { setApproved([...approved, action.id]); setNotice(`${action.id} approved. Execution remains policy-gated.`); }).catch(() => setNotice("Approval was blocked by policy.")); }}>Approve</button> : <button className="row-more"><MoreHorizontal size={17} /></button>}</td></tr>)}</tbody></table></div></section>
          <footer className="footer-note"><span><span className="live-dot" /> All systems operational</span><span>Last synced just now</span></footer>
        </div>
      </section>
    </main>
  );
}
function Metric({ label, value, change, icon: Icon, note, negative = false }: { label: string; value: string; change: string; icon: typeof CircleDollarSign; note: string; negative?: boolean }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><div className={`metric-change ${negative ? "negative" : ""}`}><ArrowUpRight size={14} /> {change} <small>{note}</small></div></div>; }
function RiskBar({ label, value, width, tone }: { label: string; value: string; width: string; tone: string }) { return <div className="risk-row"><div><span><i className={`risk-dot ${tone}`} />{label}</span><b>{value}</b></div><div className="track"><span className={tone} style={{ width }} /></div></div>; }
