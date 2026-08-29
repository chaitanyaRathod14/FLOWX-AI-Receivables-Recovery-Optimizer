"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Play,
  Check,
} from "lucide-react";
import { getIntelligence, IntelligenceData } from "@/lib/api";
import AppShell from "@/components/AppShell";

const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

export default function Intelligence() {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getIntelligence().then(setData).catch((e) => setError(e.message));
  }, []);

  if (!data && !error) {
    return (
      <AppShell>
        <div className="loading">Loading FLOWX intelligence engine...</div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="page-error">{error}</div>
      </AppShell>
    );
  }

  const next = data!.recommended_next_action;

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FLOWX INTELLIGENCE</p>
          <h2>Cash Intelligence Center</h2>
          <p className="subhead">
            Identify revenue leakage, detect customer behavior patterns, and
            simulate optimal recovery paths.
          </p>
        </div>
        <Link href="/" className="scenario-button secondary-button">
          <ArrowLeft size={15} /> Back to overview
        </Link>
      </div>

      <div className="intelligence-grid">
        {/* SCORE CARD */}
        <section className="panel score-card">
          <div className="intel-icon">
            <BrainCircuit size={20} />
          </div>
          <p className="eyebrow">CASH VELOCITY SCORE</p>
          <strong>{data!.cash_velocity_score}</strong>
          <span>
            /100 ·{" "}
            {data!.cash_velocity_score >= 75
              ? "Healthy portfolio velocity"
              : "Action required on aged accounts"}
          </span>
          <div className="score-track">
            <i style={{ width: `${data!.cash_velocity_score}%` }} />
          </div>
          <small>
            Measures how efficiently outstanding receivables convert to settled
            cash based on payment velocity and commitment fulfillment.
          </small>
        </section>

        {/* LEAKAGE DETECTOR */}
        <section className="panel leakage-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CASH LEAKAGE DETECTOR</p>
              <h3>{money(data!.total_leakage)} identified exposure</h3>
            </div>
            <CircleDollarSign size={20} style={{ color: "#bd7a32" }} />
          </div>
          <div className="leakage-list">
            {data!.leakage_items.length ? (
              data!.leakage_items.map((x, i) => (
                <div className="leakage-item" key={i}>
                  <div>
                    <b>{x.customer}</b>
                    <small>
                      {x.invoice_number} · {x.reason}
                    </small>
                  </div>
                  <strong>{money(x.value)}</strong>
                </div>
              ))
            ) : (
              <div className="empty-state">No active leakage signals detected.</div>
            )}
          </div>
        </section>

        {/* BEST ACTION NOW */}
        <section className="panel next-action">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AUTONOMOUS RECOMMENDATION</p>
              <h3>Top Priority Action</h3>
            </div>
            <Sparkles size={20} style={{ color: "var(--green)" }} />
          </div>

          <div className="next-customer">
            <div>
              <b>{next.customer}</b>
              <small>
                {next.invoice} · {next.risk} risk exposure ·{" "}
                {money(next.amount)}
              </small>
            </div>
            <span>{next.confidence}% confidence</span>
          </div>

          <div className="recommendation">
            <ArrowUpRight size={18} />
            <div style={{ flex: 1 }}>
              <b>{next.action}</b>
              <small>
                Engineered for maximum cash velocity within your configured
                merchant policies.
              </small>
            </div>
            <Link
              href="/recovery"
              className="approve-button"
              style={{
                background: "var(--deep)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
              }}
            >
              <Play size={12} fill="currentColor" /> Open Action Queue
            </Link>
          </div>
        </section>

        {/* RECEIVABLES HEALTH FINGERPRINT */}
        <section className="panel health-card-wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PORTFOLIO HEALTH</p>
              <h3>Receivables Risk Fingerprint</h3>
            </div>
            <TrendingUp size={20} style={{ color: "var(--green)" }} />
          </div>

          <div className="health-metrics">
            {Object.entries(data!.portfolio_health).map(([k, v]) => (
              <div key={k}>
                <span>{k.replaceAll("_", " ")}</span>
                <b>{v}%</b>
                <i>
                  <em style={{ width: `${v}%` }} />
                </i>
              </div>
            ))}
          </div>

          <div className="policy-badge">
            <ShieldCheck size={14} /> 100% Policy-Safe Autonomous Engine
          </div>
        </section>
      </div>
    </AppShell>
  );
}
