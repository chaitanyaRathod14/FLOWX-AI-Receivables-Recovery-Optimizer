"use client";

import { NegotiationSimulation } from "@/lib/api";

type Props = {
  simulation: NegotiationSimulation;
};

export default function NegotiationCard({
  simulation,
}: Props) {
  const {
    invoice,
    baseline,
    negotiation,
    recommendation,
    guardrails,
  } = simulation;

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

      {/* Header */}
      <div>
        <p className="text-sm font-medium text-slate-500">
          FLOWX Negotiation Intelligence
        </p>

        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Optimize the recovery, not just the reminder
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Invoice {invoice.invoice_number} ·{" "}
          {invoice.customer_name}
        </p>
      </div>

      {/* Comparison */}
      <div className="grid gap-4 md:grid-cols-2">

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-500">
            Standard Approach
          </p>

          <h3 className="mt-2 text-lg font-semibold">
            {baseline.strategy}
          </h3>

          <p className="mt-4 text-2xl font-bold">
            ₹{baseline.expected_recovery.toLocaleString()}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Expected in {baseline.expected_days} days
          </p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-sm font-medium text-indigo-700">
            FLOWX Recommendation
          </p>

          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            {negotiation.strategy}
          </h3>

          <p className="mt-4 text-2xl font-bold text-slate-900">
            ₹{negotiation.expected_recovery.toLocaleString()}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Expected in {negotiation.expected_days} days
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">
                Discount
              </span>

              <p className="font-semibold">
                {negotiation.discount_percent}%
              </p>
            </div>

            <div>
              <span className="text-slate-500">
                Confidence
              </span>

              <p className="font-semibold">
                {negotiation.confidence}%
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Recommendation */}
      <div className="rounded-xl border border-slate-200 p-5">
        <p className="text-sm font-medium text-slate-500">
          Recommended Negotiation
        </p>

        <p className="mt-2 text-base font-semibold text-slate-900">
          {recommendation.action}
        </p>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {recommendation.reason}
        </p>
      </div>

      {/* Impact */}
      <div className="grid gap-4 md:grid-cols-3">

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Cash acceleration
          </p>

          <p className="mt-1 text-xl font-semibold">
            {recommendation.cash_acceleration_days} days
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Discount cost
          </p>

          <p className="mt-1 text-xl font-semibold">
            ₹{recommendation.discount_cost.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Approval
          </p>

          <p className="mt-1 text-xl font-semibold">
            {guardrails.requires_approval
              ? "Required"
              : "Not Required"}
          </p>
        </div>

      </div>

      {/* Guardrails */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">
          Bounded & Gated Decision
        </p>

        <p className="mt-1 text-sm text-amber-800">
          Maximum allowed discount:{" "}
          {guardrails.max_discount_percent}%.
          The recommended action requires approval before execution.
        </p>
      </div>

    </div>
  );
}