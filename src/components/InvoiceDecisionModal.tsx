"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  CircleAlert,
  Clock3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

import {
  getInvoiceDecision,
  InvoiceDecision,
} from "@/lib/api";

const money = (value: number) =>
  `₹${Math.round(value).toLocaleString("en-IN")}`;

export default function InvoiceDecisionModal({
  invoiceId,
  onClose,
}: {
  invoiceId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<InvoiceDecision | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    getInvoiceDecision(invoiceId)
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((err) =>
        {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not analyze invoice"
            );
          }
        }
      );

    return () => {
      active = false;
    };
  }, [invoiceId, retryKey]);

  if (error) {
    return (
      <div className="decision-overlay">
        <div className="decision-modal">
          <button
            className="decision-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>

          <div className="page-error">
            <CircleAlert size={17} />
            {error}
          </div>

          <button
            className="decision-button"
            onClick={() => {
              setData(null);
              setError("");
              setRetryKey((value) => value + 1);
            }}
          >
            <BrainCircuit size={13} />
            Retry analysis
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="decision-overlay">
        <div className="decision-modal decision-loading">
          <BrainCircuit size={24} />
          <strong>
            FLOWX is analyzing this invoice...
          </strong>
          <small>
            Evaluating risk, customer behaviour and
            recovery strategies.
          </small>
        </div>
      </div>
    );
  }

  const riskClass =
    data.risk.tier.toLowerCase();

  const best =
    data.recommended_strategy;

  return (
    <div className="decision-overlay">
      <div className="decision-modal">

        <button
          className="decision-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* HEADER */}
        <div className="decision-header">

          <div>
            <p className="eyebrow">
              FLOWX AI DECISION
            </p>

            <h2>
              {data.invoice.invoice_number}
            </h2>

            <p className="subhead">
              {data.invoice.customer_name}
              {" · "}
              {money(data.invoice.outstanding)}
              {" outstanding"}
            </p>
          </div>

          <span
            className={`risk-pill ${riskClass}`}
          >
            <i />
            {data.risk.tier} risk
          </span>

        </div>

        {/* RISK SUMMARY */}
        <div className="decision-risk-summary">

          <div>
            <span>Payment delay probability</span>
            <strong>
              {data.risk.probability}%
            </strong>
          </div>

          <div>
            <span>Overdue</span>
            <strong>
              {data.invoice.overdue_days} days
            </strong>
          </div>

          <div>
            <span>Predicted delay</span>
            <strong>
              {data.risk.predicted_delay_days} days
            </strong>
          </div>

        </div>

        {/* WHY RISKY */}
        <section className="decision-section">

          <div className="decision-section-title">
            <div>
              <p className="eyebrow">
                EXPLAINABLE RISK
              </p>

              <h3>
                Why FLOWX considers this risky
              </h3>
            </div>

            <BrainCircuit size={19} />
          </div>

          <div className="risk-driver-grid">

            {data.risk_drivers.map(
              (driver, index) => (
                <div
                  className="risk-driver"
                  key={`${driver.factor}-${index}`}
                >

                  <div className="risk-driver-top">
                    <b>{driver.factor}</b>

                    <span
                      className={
                        driver.impact === "HIGH"
                          ? "impact-high"
                          : "impact-medium"
                      }
                    >
                      {driver.impact}
                    </span>
                  </div>

                  <strong>
                    {driver.value}
                  </strong>

                  <small>
                    {driver.explanation}
                  </small>

                </div>
              )
            )}

          </div>

        </section>

        {/* CUSTOMER BEHAVIOUR */}
        <section className="decision-section">

          <div className="decision-section-title">
            <div>
              <p className="eyebrow">
                CUSTOMER FINGERPRINT
              </p>

              <h3>
                Payment behaviour
              </h3>
            </div>

            <TrendingUp size={19} />
          </div>

          <div className="customer-fingerprint">

            <div>
              <span>Invoices analysed</span>
              <strong>
                {data.customer_behavior.invoice_count}
              </strong>
            </div>

            <div>
              <span>Late payment rate</span>
              <strong>
                {data.customer_behavior.late_payment_rate}%
              </strong>
            </div>

            <div>
              <span>Average delay</span>
              <strong>
                {data.customer_behavior.average_delay_days} days
              </strong>
            </div>

          </div>

        </section>

        {/* STRATEGIES */}
        <section className="decision-section">

          <div className="decision-section-title">
            <div>
              <p className="eyebrow">
                RECOVERY SIMULATOR
              </p>

              <h3>
                Compare recovery strategies
              </h3>
            </div>

            <Sparkles size={19} />
          </div>

          <div className="strategy-list">

            {data.strategies.map(
              (strategy) => {

                const selected =
                  strategy.type === best.type;

                return (
                  <div
                    className={`strategy-card ${
                      selected
                        ? "strategy-recommended"
                        : ""
                    } ${
                      !strategy.available
                        ? "strategy-disabled"
                        : ""
                    }`}
                    key={strategy.type}
                  >

                    <div>
                      <div className="strategy-name">

                        <b>
                          {strategy.name}
                        </b>

                        {selected && (
                          <span className="recommended-badge">
                            Recommended
                          </span>
                        )}

                        {!strategy.available && (
                          <span className="blocked-badge">
                            Policy disabled
                          </span>
                        )}

                      </div>

                      <small>
                        {strategy.reason}
                      </small>
                    </div>

                    <div className="strategy-stats">

                      <div>
                        <span>
                          Expected recovery
                        </span>

                        <strong>
                          {money(
                            strategy.expected_recovery
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Time
                        </span>

                        <strong>
                          {strategy.expected_days}d
                        </strong>
                      </div>

                      <div>
                        <span>
                          Confidence
                        </span>

                        <strong>
                          {strategy.confidence}%
                        </strong>
                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>

        {/* CASH IMPACT */}
        <section className="cash-impact">

          <div className="cash-impact-heading">

            <div>
              <p className="eyebrow">
                CASH IMPACT
              </p>

              <h3>
                Why acting now matters
              </h3>
            </div>

            <CircleAlert size={19} />

          </div>

          <div className="cash-impact-grid">

            <div>
              <span>
                If no action is taken
              </span>

              <strong>
                {money(
                  data.cash_impact
                    .do_nothing_expected_recovery
                )}
              </strong>

              <small>
                expected recovery
              </small>
            </div>

            <ArrowRight size={18} />

            <div>
              <span>
                FLOWX recommendation
              </span>

              <strong>
                {money(
                  data.cash_impact
                    .recommended_expected_recovery
                )}
              </strong>

              <small>
                expected recovery
              </small>
            </div>

            <div className="acceleration-value">

              <span>
                Cash acceleration
              </span>

              <strong>
                +{money(
                  data.cash_impact
                    .cash_acceleration
                )}
              </strong>

              <small>
                estimated
              </small>

            </div>

          </div>

          <div className="days-saved">

            <Clock3 size={15} />

            <span>
              Estimated time saved:
              {" "}
              <b>
                {data.cash_impact.estimated_days_saved}
                {" days"}
              </b>
            </span>

          </div>

        </section>

        {/* FORECAST */}
        <section className="decision-section">

          <div className="decision-section-title">

            <div>
              <p className="eyebrow">
                CASH FORECAST
              </p>

              <h3>
                Expected recovery timeline
              </h3>
            </div>

            <Clock3 size={19} />

          </div>

          <div className="forecast-grid">

            <div>
              <span>Next 7 days</span>
              <strong>
                {money(data.forecast["7_days"])}
              </strong>
            </div>

            <div>
              <span>Next 14 days</span>
              <strong>
                {money(data.forecast["14_days"])}
              </strong>
            </div>

            <div>
              <span>Next 30 days</span>
              <strong>
                {money(data.forecast["30_days"])}
              </strong>
            </div>

          </div>

        </section>

        {/* RECOMMENDATION */}
        <div className="decision-recommendation">

          <div className="recommendation-icon">
            <Sparkles size={18} />
          </div>

          <div>
            <p className="eyebrow">
              FLOWX RECOMMENDATION
            </p>

            <strong>
              {best.name}
            </strong>

            <small>
              {data.recommendation_reason}
            </small>
          </div>

        </div>

        {/* POLICY */}
        <div className="decision-policy">

          <ShieldCheck size={16} />

          <span>
            <b>
              Policy guardrails remain active.
            </b>

            <small>
              This analysis recommends an action;
              it does not authorize financial execution.
            </small>
          </span>

          <Check size={16} />

        </div>

      </div>
    </div>
  );
}