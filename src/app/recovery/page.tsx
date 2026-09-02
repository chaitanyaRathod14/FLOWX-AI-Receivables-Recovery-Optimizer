"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  approveAction,
  executeAction,
  getRecoveryActions,
  simulateRecovery,
  type NegotiationOffer,
  type NegotiationSimulation,
  type RecoveryAction,
} from "@/lib/api";
import AppShell from "@/components/AppShell";

function formatCurrency(
  value?: number
) {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatPercent(
  value?: number
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "—";
  }

  return `${Math.round(value * 100)}%`;
}

function riskClass(
  risk: string
) {

  const value =
    risk.toUpperCase();

  if (value === "HIGH") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (value === "MEDIUM") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-green-500/30 bg-green-500/10 text-green-300";
}

function statusClass(
  status: string
) {

  const value =
    status.toUpperCase();

  if (
    value.includes("APPROVED") ||
    value.includes("EXECUTED") ||
    value.includes("COMPLETED")
  ) {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (
    value.includes("PENDING")
  ) {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-white/10 bg-white/5 text-white/70";
}

function OfferCard({
  offer,
  recommended,
}: {
  offer: NegotiationOffer;
  recommended?: boolean;
}) {

  return (
    <div
      className={`rounded-2xl border p-5 ${
        recommended
          ? "border-purple-400/50 bg-purple-500/10"
          : "border-white/10 bg-white/3"
      }`}
    >

      <div className="flex items-start justify-between gap-4">

        <div>
          <p className="text-sm font-medium text-white/50">
            {offer.strategy}
          </p>

          <h3 className="mt-1 text-lg font-semibold text-white">
            {offer.title ||
              "Recovery Strategy"}
          </h3>
        </div>

        {recommended && (
          <span className="rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-200">
            Recommended
          </span>
        )}

      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">

        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-xs text-white/40">
            Discount
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            {offer.discount_percent ?? 0}%
          </p>
        </div>

        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-xs text-white/40">
            Payment Terms
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            {offer.payment_days ?? "—"} days
          </p>
        </div>

        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-xs text-white/40">
            Expected Recovery
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            {formatCurrency(
              offer.expected_recovery
            )}
          </p>
        </div>

        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-xs text-white/40">
            Expected ETA
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            {offer.expected_days ?? "—"} days
          </p>
        </div>

      </div>

      <div className="mt-4">

        <div className="mb-1 flex justify-between text-xs">
          <span className="text-white/40">
            Confidence
          </span>

          <span className="text-white/70">
            {formatPercent(
              offer.confidence
            )}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">

          <div
            className="h-full rounded-full bg-purple-400"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  (offer.confidence || 0) * 100
                )
              )}%`,
            }}
          />

        </div>

      </div>

      {offer.reason && (
        <p className="mt-4 text-sm leading-6 text-white/60">
          {offer.reason}
        </p>
      )}

      {offer.negotiation_message && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">

          <p className="text-xs font-medium uppercase tracking-wide text-white/40">
            Suggested Negotiation
          </p>

          <p className="mt-2 text-sm leading-6 text-white/80">
            {offer.negotiation_message}
          </p>

        </div>
      )}

      {offer.requires_approval && (
        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Approval required before execution.
        </div>
      )}

    </div>
  );
}

export default function RecoveryPage() {

  const [
    actions,
    setActions,
  ] = useState<RecoveryAction[]>([]);

  const [
    selectedAction,
    setSelectedAction,
  ] = useState<RecoveryAction | null>(
    null
  );

  const [
    simulation,
    setSimulation,
  ] = useState<NegotiationSimulation | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    simulating,
    setSimulating,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState<number | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  async function loadActions() {

    try {

      setLoading(true);
      setError(null);

      const data =
        await getRecoveryActions();

      setActions(data);

      if (
        data.length > 0 &&
        !selectedAction
      ) {
        setSelectedAction(
          data[0]
        );
      }

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recovery actions."
      );

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadActions();
  }, []);

  async function handleSimulate(
    action: RecoveryAction
  ) {

    try {

      setSelectedAction(action);
      setSimulation(null);
      setSimulating(true);
      setError(null);

      const result =
        await simulateRecovery(
          action.id
        );

      setSimulation(result);

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Simulation failed."
      );

    } finally {

      setSimulating(false);
    }
  }

  async function handleApprove(
    action: RecoveryAction
  ) {

    try {

      setActionLoading(action.id);
      setError(null);

      await approveAction(
        action.id
      );

      await loadActions();

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Approval failed."
      );

    } finally {

      setActionLoading(null);
    }
  }

  async function handleExecute(
    action: RecoveryAction
  ) {

    try {

      setActionLoading(action.id);
      setError(null);

      await executeAction(
        action.id
      );

      await loadActions();

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Execution failed."
      );

    } finally {

      setActionLoading(null);
    }
  }

  return (
    <AppShell>
      <main className="recovery-page">

      <div className="mx-auto max-w-7xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8">

          <p className="text-sm font-medium text-purple-300">
            FLOWX Recovery Intelligence
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Recovery & Negotiation
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
            FLOWX does not simply identify overdue invoices.
            It evaluates customer behavior, simulates recovery
            outcomes, and recommends the terms most likely to
            accelerate cash recovery.
          </p>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">

          {/* =================================================
              RECOVERY ACTIONS
          ================================================= */}

          <section className="rounded-2xl border border-white/10 bg-white/3">

            <div className="border-b border-white/10 px-5 py-4">

              <h2 className="font-semibold">
                Recovery Opportunities
              </h2>

              <p className="mt-1 text-xs text-white/40">
                Prioritized by risk and recovery potential
              </p>

            </div>

            <div className="divide-y divide-white/10">

              {loading ? (

                <div className="p-6 text-sm text-white/40">
                  Loading recovery opportunities...
                </div>

              ) : actions.length === 0 ? (

                <div className="p-6 text-sm text-white/40">
                  No recovery opportunities found.
                </div>

              ) : (

                actions.map(
                  (action) => {

                    const selected =
                      selectedAction?.id === action.id;

                    return (
                      <button
                        key={action.id}
                        onClick={() =>
                          setSelectedAction(
                            action
                          )
                        }
                        className={`w-full p-5 text-left transition ${
                          selected
                            ? "bg-purple-500/10"
                            : "hover:bg-white/3"
                        }`}
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="font-medium text-white">
                              {action.customer_name}
                            </p>

                            <p className="mt-1 text-xs text-white/40">
                              {action.invoice_number}
                            </p>

                          </div>

                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-medium ${riskClass(
                              action.risk_tier
                            )}`}
                          >
                            {action.risk_tier}
                          </span>

                        </div>

                        <div className="mt-4 flex items-center justify-between">

                          <span className="text-sm font-semibold">
                            {formatCurrency(
                              action.invoice_amount
                            )}
                          </span>

                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(
                              action.status
                            )}`}
                          >
                            {action.status}
                          </span>

                        </div>

                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/40">
                          {action.reason}
                        </p>

                      </button>
                    );
                  }
                )

              )}

            </div>

          </section>

          {/* =================================================
              DETAIL PANEL
          ================================================= */}

          <section>

            {!selectedAction ? (

              <div className="rounded-2xl border border-white/10 bg-white/3 p-10 text-center">

                <p className="text-white/40">
                  Select a recovery opportunity
                  to analyze it.
                </p>

              </div>

            ) : (

              <div className="space-y-6">

                {/* ==========================================
                    ACTION SUMMARY
                ========================================== */}

                <div className="rounded-2xl border border-white/10 bg-white/3 p-6">

                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
                          Recovery Opportunity
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${riskClass(
                            selectedAction.risk_tier
                          )}`}
                        >
                          {selectedAction.risk_tier} RISK
                        </span>

                      </div>

                      <h2 className="mt-3 text-2xl font-semibold">
                        {selectedAction.customer_name}
                      </h2>

                      <p className="mt-1 text-sm text-white/40">
                        Invoice {selectedAction.invoice_number}
                      </p>

                    </div>

                    <div className="text-left md:text-right">

                      <p className="text-xs text-white/40">
                        Outstanding Exposure
                      </p>

                      <p className="mt-1 text-2xl font-semibold">
                        {formatCurrency(
                          selectedAction.invoice_amount
                        )}
                      </p>

                    </div>

                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Current Recommendation
                    </p>

                    <p className="mt-2 text-sm leading-6 text-white/70">
                      {selectedAction.reason ||
                        "FLOWX recommends evaluating the recovery opportunity before execution."}
                    </p>

                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">

                    <button
                      onClick={() =>
                        handleSimulate(
                          selectedAction
                        )
                      }
                      disabled={simulating}
                      className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {simulating
                        ? "Running Simulation..."
                        : "Simulate Negotiation"}
                    </button>

                    {selectedAction.status
                      .toUpperCase()
                      .includes("PENDING") && (

                      <button
                        onClick={() =>
                          handleApprove(
                            selectedAction
                          )
                        }
                        disabled={
                          actionLoading ===
                          selectedAction.id
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                      >
                        {actionLoading ===
                        selectedAction.id
                          ? "Processing..."
                          : "Approve Action"}
                      </button>
                    )}

                    {selectedAction.status
                      .toUpperCase()
                      .includes("APPROVED") && (

                      <button
                        onClick={() =>
                          handleExecute(
                            selectedAction
                          )
                        }
                        disabled={
                          actionLoading ===
                          selectedAction.id
                        }
                        className="rounded-xl border border-green-500/20 bg-green-500/10 px-5 py-3 text-sm font-medium text-green-200 transition hover:bg-green-500/20 disabled:opacity-50"
                      >
                        {actionLoading ===
                        selectedAction.id
                          ? "Executing..."
                          : "Execute Recovery"}
                      </button>
                    )}

                  </div>

                </div>

                {/* ==========================================
                    NEGOTIATION SIMULATION
                ========================================== */}

                {simulation && (

                  <div className="space-y-6">

                    <div className="rounded-2xl border border-purple-400/20 bg-purple-500/6 p-6">

                      <div className="flex items-start gap-4">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200">
                          AI
                        </div>

                        <div>

                          <p className="text-xs font-medium uppercase tracking-wide text-purple-300">
                            FLOWX Negotiation Engine
                          </p>

                          <h2 className="mt-1 text-xl font-semibold">
                            Optimize the recovery,
                            not just the reminder.
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-white/50">
                            FLOWX evaluates different recovery
                            terms before an action is taken.
                            This allows the merchant to compare
                            speed, recovery amount, risk and
                            negotiation cost.
                          </p>

                        </div>

                      </div>

                    </div>

                    {/* ======================================
                        CASH IMPACT
                    ====================================== */}

                    {simulation.cash_impact && (

                      <div className="grid gap-4 sm:grid-cols-3">

                        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">

                          <p className="text-xs text-white/40">
                            Expected Recovery
                          </p>

                          <p className="mt-2 text-2xl font-semibold">
                            {formatCurrency(
                              simulation
                                .cash_impact
                                .recommended_expected_recovery
                            )}
                          </p>

                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">

                          <p className="text-xs text-white/40">
                            Cash Acceleration
                          </p>

                          <p className="mt-2 text-2xl font-semibold">
                            {formatCurrency(
                              simulation
                                .cash_impact
                                .cash_acceleration
                            )}
                          </p>

                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">

                          <p className="text-xs text-white/40">
                            Days Saved
                          </p>

                          <p className="mt-2 text-2xl font-semibold">
                            {simulation
                              .cash_impact
                              .estimated_days_saved ??
                              "—"}
                          </p>

                        </div>

                      </div>
                    )}

                    {/* ======================================
                        CUSTOMER BEHAVIOR
                    ====================================== */}

                    {simulation.customer_behavior && (

                      <div className="rounded-2xl border border-white/10 bg-white/3 p-6">

                        <h2 className="text-lg font-semibold">
                          Why FLOWX chose this approach
                        </h2>

                        <p className="mt-1 text-sm text-white/40">
                          Customer behavior used by the
                          negotiation engine.
                        </p>

                        <div className="mt-5 grid gap-4 sm:grid-cols-4">

                          <div>
                            <p className="text-xs text-white/40">
                              Invoice History
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {simulation
                                .customer_behavior
                                .invoice_count ??
                                "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-white/40">
                              Late Payment Rate
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {formatPercent(
                                simulation
                                  .customer_behavior
                                  .late_payment_rate
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-white/40">
                              Average Delay
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {simulation
                                .customer_behavior
                                .average_delay_days ??
                                "—"}{" "}
                              days
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-white/40">
                              Promise Reliability
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {formatPercent(
                                simulation
                                  .customer_behavior
                                  .promise_kept_rate
                              )}
                            </p>
                          </div>

                        </div>

                      </div>
                    )}

                    {/* ======================================
                        NEGOTIATION REASON
                    ====================================== */}

                    {simulation.negotiation_reason && (

                      <div className="rounded-2xl border border-white/10 bg-white/3 p-6">

                        <p className="text-xs font-medium uppercase tracking-wide text-white/30">
                          Decision Explanation
                        </p>

                        <p className="mt-3 text-sm leading-7 text-white/70">
                          {simulation.negotiation_reason}
                        </p>

                      </div>
                    )}

                    {/* ======================================
                        OFFERS
                    ====================================== */}

                    {simulation.offers &&
                      simulation.offers.length > 0 && (

                      <div>

                        <div className="mb-4">

                          <h2 className="text-xl font-semibold">
                            Compare Recovery Terms
                          </h2>

                          <p className="mt-1 text-sm text-white/40">
                            Choose the recovery outcome that
                            provides the best balance between
                            speed and recovered cash.
                          </p>

                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">

                          {simulation.offers.map(
                            (
                              offer,
                              index
                            ) => (

                              <OfferCard
                                key={`${offer.strategy}-${index}`}
                                offer={offer}
                                recommended={
                                  simulation
                                    .recommended_strategy ===
                                  offer.strategy
                                }
                              />

                            )
                          )}

                        </div>

                      </div>
                    )}

                    {/* ======================================
                        SINGLE RECOMMENDED OFFER
                    ====================================== */}

                    {!simulation.offers &&
                      simulation.recommended_offer && (

                      <div>

                        <h2 className="mb-4 text-xl font-semibold">
                          Recommended Negotiation
                        </h2>

                        <OfferCard
                          offer={
                            simulation.recommended_offer
                          }
                          recommended
                        />

                      </div>
                    )}

                    {/* ======================================
                        APPROVAL GATE
                    ====================================== */}

                    {simulation.requires_approval && (

                      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">

                        <div className="flex gap-3">

                          <div className="mt-0.5 text-yellow-300">
                            !
                          </div>

                          <div>

                            <h3 className="font-semibold text-yellow-100">
                              Approval required
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-yellow-100/60">
                              FLOWX does not automatically execute
                              a recovery action when policy limits
                              require human approval.
                            </p>

                          </div>

                        </div>

                      </div>
                    )}

                    {/* ======================================
                        HUMAN IN THE LOOP
                    ====================================== */}

                    <div className="rounded-2xl border border-white/10 bg-white/3 p-6">

                      <p className="text-xs font-medium uppercase tracking-wide text-white/30">
                        Controlled Automation
                      </p>

                      <h2 className="mt-2 text-lg font-semibold">
                        AI recommends. The merchant decides.
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-white/50">
                        FLOWX keeps recovery actions bounded by
                        policy and approval rules. The simulation
                        is designed to give the merchant context
                        before execution.
                      </p>

                    </div>

                  </div>
                )}

              </div>
            )}

          </section>

        </div>

      </div>

      </main>
    </AppShell>
  );
}