"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ShieldCheck,
  Sparkles,
  WalletCards,
  AlertTriangle,
} from "lucide-react";
import {
  getRecoveryActions,
  NegotiationSimulation,
  simulateNegotiation,
} from "@/lib/api";
import AppShell from "@/components/AppShell";

type Action = {
  id: number;
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

export default function NegotiationPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [selected, setSelected] = useState<Action | null>(null);
  const [simulation, setSimulation] =
    useState<NegotiationSimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRecoveryActions()
      .then((data) => {
        const formatted = data as Action[];
        setActions(formatted);

        if (formatted.length > 0) {
          setSelected(formatted[0]);
        }
      })
      .catch(() => {
        setError("Unable to load recovery actions.");
      });
  }, []);

  async function runSimulation() {
    if (!selected) return;

    setLoading(true);
    setError("");

    try {
      const result = await simulateNegotiation(selected.id);
      setSimulation(result);
    } catch {
      setError("Simulation could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  const invoiceAmount =
    simulation?.invoice.outstanding || selected?.invoice_amount || 0;

  const defaultRecovery = Math.round(
    simulation?.baseline.expected_recovery ?? invoiceAmount * 0.62
  );
  const negotiatedRecovery = Math.round(
    simulation?.negotiation.expected_recovery ?? invoiceAmount * 0.98
  );

  const defaultDays = simulation?.baseline.expected_days ?? 45;
  const negotiatedDays = simulation?.negotiation.expected_days ?? 15;

  const discount = simulation?.negotiation.discount_percent ?? 2;
  const discountCost = Math.round(
    simulation?.recommendation.discount_cost ??
      invoiceAmount * (discount / 100)
  );

  return (
    <AppShell>
      <div className="content negotiation-page">
          <Link href="/" className="back-link">
            <ArrowLeft size={15} />
            Back to overview
          </Link>

          <div className="hero-row">
            <div>
              <p className="eyebrow">
                FLOWX NEGOTIATION ENGINE
              </p>

              <h2>
                Recover faster.
                <br />
                Negotiate smarter.
              </h2>

              <p className="subhead">
                FLOWX analyzes payment behavior and simulates
                recovery terms before an action is taken.
              </p>
            </div>
          </div>

          {error && (
            <div className="toast">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <section className="negotiation-layout">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    RECOVERY CASE
                  </p>

                  <h3>Select an invoice</h3>
                </div>
              </div>

              <div className="case-list">
                {actions.length === 0 ? (
                  <div className="empty-state">
                    No recovery actions available.
                  </div>
                ) : (
                  actions.map((action) => (
                    <button
                      key={action.id}
                      className={`case-card ${
                        selected?.id === action.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelected(action);
                        setSimulation(null);
                      }}
                    >
                      <div>
                        <strong>
                          {action.customer_name}
                        </strong>

                        <small>
                          {action.invoice_number}
                        </small>
                      </div>

                      <div className="case-right">
                        <strong>
                          ₹
                          {Math.round(
                            action.invoice_amount
                          ).toLocaleString("en-IN")}
                        </strong>

                        <span
                          className={`risk-pill ${action.risk_tier.toLowerCase()}`}
                        >
                          <i />
                          {action.risk_tier}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="panel negotiation-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    AI DECISION ENGINE
                  </p>

                  <h3>Negotiation opportunity</h3>
                </div>

                <Sparkles size={20} />
              </div>

              {selected ? (
                <>
                  <div className="customer-summary">
                    <div>
                      <span>Customer</span>
                      <strong>
                        {selected.customer_name}
                      </strong>
                    </div>

                    <div>
                      <span>Invoice</span>
                      <strong>
                        {selected.invoice_number}
                      </strong>
                    </div>

                    <div>
                      <span>Outstanding</span>
                      <strong>
                        ₹
                        {Math.round(
                          selected.invoice_amount
                        ).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  </div>

                  <div className="ai-recommendation">
                    <div className="recommendation-icon">
                      <Sparkles size={19} />
                    </div>

                    <div>
                      <span>
                        FLOWX RECOMMENDS
                      </span>

                      <h4>
                        {simulation?.recommendation.action ||
                          `Offer ${discount}% discount for payment within ${negotiatedDays} days`}
                      </h4>

                      <p>
                        {simulation?.recommendation.reason ||
                          "Run a simulation to evaluate the recommendation against customer behavior and policy limits."}
                      </p>
                    </div>
                  </div>

                  <div className="comparison">
                    <div className="comparison-card">
                      <span>
                        Standard recovery
                      </span>

                      <strong>
                        ₹
                        {defaultRecovery.toLocaleString(
                          "en-IN"
                        )}
                      </strong>

                      <small>
                        <Clock3 size={13} />
                        ~{defaultDays} days
                      </small>
                    </div>

                    <div className="comparison-arrow">
                      <ArrowRight size={18} />
                    </div>

                    <div className="comparison-card recommended">
                      <span>
                        FLOWX negotiation
                      </span>

                      <strong>
                        ₹
                        {negotiatedRecovery.toLocaleString(
                          "en-IN"
                        )}
                      </strong>

                      <small>
                        <Clock3 size={13} />
                        ~{negotiatedDays} days
                      </small>
                    </div>
                  </div>

                  <div className="impact-grid">
                    <div>
                      <span>Cash acceleration</span>
                      <strong>
                        {defaultDays -
                          negotiatedDays}{" "}
                        days
                      </strong>
                    </div>

                    <div>
                      <span>Discount cost</span>
                      <strong>
                        ₹
                        {discountCost.toLocaleString(
                          "en-IN"
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Risk confidence</span>
                      <strong>
                        {simulation?.negotiation.confidence ??
                          Math.round(selected.confidence * 100)}
                        %
                      </strong>
                    </div>
                  </div>

                  <div className="policy-callout">
                    <ShieldCheck size={17} />

                    <span>
                      <b>
                        Policy guardrails active
                      </b>

                      <small>
                        The negotiated discount must
                        remain within the merchant&apos;s
                        approved policy.
                      </small>
                    </span>

                    <Check size={16} />
                  </div>

                  <button
                    className="scenario-button full"
                    onClick={runSimulation}
                    disabled={loading}
                  >
                    <Sparkles size={15} />

                    {loading
                      ? "Simulating..."
                      : "Simulate negotiation"}
                  </button>

                  {simulation && (
                    <div className="simulation-result">
                      <div className="result-header">
                        <Check size={18} />

                        <div>
                          <strong>
                            Simulation completed
                          </strong>

                          <span>
                            No recovery action has been
                            executed.
                          </span>
                        </div>
                      </div>

                      <p>
                        FLOWX evaluated the proposed negotiation against
                        the available recovery data and policy limits.
                      </p>
                      <div className="impact-grid">
                        <div>
                          <span>Expected recovery</span>
                          <strong>
                            ₹{Math.round(simulation.negotiation.expected_recovery).toLocaleString("en-IN")}
                          </strong>
                        </div>
                        <div>
                          <span>Expected payment</span>
                          <strong>{simulation.negotiation.expected_days} days</strong>
                        </div>
                        <div>
                          <span>Approval</span>
                          <strong>{simulation.guardrails.requires_approval ? "Required" : "Not required"}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  Select a recovery case to begin.
                </div>
              )}
            </div>
          </section>

          <section className="defense-strip">
            <div>
              <ShieldCheck size={18} />

              <span>
                <b>Explainable</b>
                <small>
                  Every recommendation has a reason.
                </small>
              </span>
            </div>

            <div>
              <WalletCards size={18} />

              <span>
                <b>Bounded</b>
                <small>
                  Actions stay within merchant policy.
                </small>
              </span>
            </div>

            <div>
              <Check size={18} />

              <span>
                <b>Gated</b>
                <small>
                  Approval is required before execution.
                </small>
              </span>
            </div>
          </section>
      </div>
    </AppShell>
  );
}