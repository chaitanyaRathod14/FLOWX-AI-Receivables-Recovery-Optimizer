"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MoreHorizontal,
  Play,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";

import {
  approveAction,
  getDashboard,
  logout,
  runDemo,
} from "@/lib/api";

/* =========================================================
   NAVIGATION
   ========================================================= */

const navItems = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
    active: true,
  },
  {
    label: "Invoices & risk",
    href: "/invoices",
    icon: ReceiptText,
  },
  {
    label: "Recovery actions",
    href: "/recovery",
    icon: Sparkles,
    count: "4",
  },
  {
    label: "Promises to pay",
    href: "/promises",
    icon: WalletCards,
  },
  {
    label: "Cash analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    label: "Cash intelligence",
    href: "/intelligence",
    icon: Sparkles,
  },

  {
  label: "AI Negotiation",
  href: "/negotiation",
  icon: Sparkles,
},
];

const systemItems = [
  {
    label: "Audit log",
    href: "/audit-log",
    icon: FileText,
  },
  {
    label: "Policies",
    href: "/settings/policies",
    icon: ShieldCheck,
  },
  {
    label: "System health",
    href: "/system-health",
    icon: Gauge,
  },
];

/* =========================================================
   FALLBACK ACTIONS
   ========================================================= */

const actions = [
  {
    id: "#RA-1042",
    customer: "Northstar Labs",
    invoice: "INV-2841",
    amount: "$18,420",
    risk: "Critical",
    detail: "48 days overdue",
    status: "Needs approval",
    tone: "critical",
  },
  {
    id: "#RA-1038",
    customer: "Morrow & Co.",
    invoice: "INV-2819",
    amount: "$9,800",
    risk: "High",
    detail: "22 days overdue",
    status: "Recommended",
    tone: "high",
  },
  {
    id: "#RA-1036",
    customer: "Pinecone Health",
    invoice: "INV-2807",
    amount: "$6,240",
    risk: "Medium",
    detail: "11 days overdue",
    status: "Recommended",
    tone: "medium",
  },
  {
    id: "#RA-1031",
    customer: "Kite Systems",
    invoice: "INV-2794",
    amount: "$3,900",
    risk: "Low",
    detail: "5 days overdue",
    status: "Executing",
    tone: "low",
  },
];

/* =========================================================
   FALLBACK CHART DATA
   ========================================================= */

const bars = [
  58,
  74,
  68,
  81,
  77,
  94,
  88,
  100,
  92,
  108,
  102,
  122,
];

const fallbackMonths = [
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
];

/* =========================================================
   USER TYPE
   ========================================================= */

type CurrentUser = {
  full_name: string;
  merchant_name: string;
};

/* =========================================================
   HOME PAGE
   ========================================================= */

export default function Home() {
  const router = useRouter();

  /* -------------------------------------------------------
     Session / hydration state
     ------------------------------------------------------- */

  const [mounted, setMounted] = useState(false);

  const [user, setUser] = useState<CurrentUser>({
    full_name: "Jordan Davis",
    merchant_name: "Acme Receivables",
  });

  const [todayLabel, setTodayLabel] = useState("");

  /* -------------------------------------------------------
     Dashboard state
     ------------------------------------------------------- */

  const [approved, setApproved] = useState<string[]>([]);

  const [dashboardActions, setDashboardActions] =
    useState<any[]>(actions);

  const [metrics, setMetrics] = useState({
    total_receivables: 248680,
    cash_recovered: 86420,
    at_risk: 42160,
    promise_kept_rate: 84.6,
  });

  const [riskDistribution, setRiskDistribution] =
    useState<
      Array<{
        risk_tier: string;
        exposure: number;
        count: number;
      }>
    >([]);

  const [recoveryTrend, setRecoveryTrend] =
    useState<
      Array<{
        month: string;
        flowx: number;
        baseline: number;
      }>
    >([]);

  const [scenarioRunning, setScenarioRunning] =
    useState(false);

  const [notice, setNotice] = useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [chartRange, setChartRange] =
    useState(12);

  /* =========================================================
     CLIENT INITIALIZATION
     ========================================================= */

  useEffect(() => {
    /*
     * Important:
     *
     * We intentionally read localStorage only after the
     * component has mounted.
     *
     * This prevents the Next.js hydration mismatch:
     *
     * Server:
     * Acme Receivables
     *
     * Client:
     * PayPal
     *
     * React now renders the same initial HTML on both sides.
     */

    setMounted(true);

    try {
      const storedUser =
        localStorage.getItem("flowx_user");

      if (storedUser) {
        const parsedUser =
          JSON.parse(storedUser);

        setUser({
          full_name:
            parsedUser.full_name ||
            "Jordan Davis",

          merchant_name:
            parsedUser.merchant_name ||
            "Acme Receivables",
        });
      }
    } catch {
      setUser({
        full_name: "Jordan Davis",
        merchant_name: "Acme Receivables",
      });
    }

    /*
     * Date is also generated only on the client.
     * This prevents server/client date differences.
     */

    setTodayLabel(
      new Intl.DateTimeFormat("en-IN", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }).format(new Date()),
    );
  }, []);

  /* =========================================================
     AUTH CHECK
     ========================================================= */

  useEffect(() => {
    if (!mounted) return;

    const token =
      localStorage.getItem("flowx_token");

    if (!token) {
      router.replace("/login");
    }
  }, [mounted, router]);

  /* =========================================================
     LOAD DASHBOARD
     ========================================================= */

  useEffect(() => {
    if (!mounted) return;

    getDashboard()
      .then((data) => {
        setMetrics(data.metrics);

        setRiskDistribution(
          data.risk_distribution || [],
        );

        setRecoveryTrend(
          data.recovery_trend || [],
        );

        setDashboardActions(
          (data.actions || []).map(
            (action: any) => {
              const dueDate =
                new Date(action.due_date);

              const overdueDays = Math.max(
                0,
                Math.floor(
                  (Date.now() -
                    dueDate.getTime()) /
                    86400000,
                ),
              );

              return {
                id: `#RA-${String(
                  1100 + action.id,
                ).slice(-4)}`,

                backendId: action.id,

                customer:
                  action.customer_name,

                invoice:
                  action.invoice_number,

                amount:
                  `₹${Math.round(
                    action.invoice_amount,
                  ).toLocaleString(
                    "en-IN",
                  )}`,

                risk:
                  action.risk_tier,

                detail:
                  `${overdueDays} days overdue`,

                status:
                  action.status ===
                  "PENDING_APPROVAL"
                    ? "Needs approval"
                    : action.status
                        .split("_")
                        .map(
                          (word: string) =>
                            word
                              .charAt(0)
                              .toUpperCase() +
                            word
                              .slice(1)
                              .toLowerCase(),
                        )
                        .join(" "),

                tone:
                  action.risk_tier.toLowerCase(),
              };
            },
          ),
        );
      })
      .catch(() => {
        setNotice(
          "API unavailable. Showing the last known workspace snapshot.",
        );
      });
  }, [mounted, refreshKey]);

  /* =========================================================
     RUN DEMO SCENARIO
     ========================================================= */

  function runScenario() {
    setScenarioRunning(true);

    setNotice(
      "Demo scenario running: evaluating policy guardrails...",
    );

    runDemo()
      .then(() => {
        setNotice(
          "Scenario complete: 1 action queued for approval.",
        );

        setRefreshKey(
          (value) => value + 1,
        );
      })
      .catch(() => {
        setNotice(
          "Could not reach the FLOWX API.",
        );
      })
      .finally(() => {
        setScenarioRunning(false);
      });
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  const money = (value: number) =>
    `₹${Math.round(
      value,
    ).toLocaleString("en-IN")}`;

  const visibleTrend =
    recoveryTrend.length
      ? recoveryTrend.slice(-chartRange)
      : [];

  const fallbackTrend =
    bars.map((flowx, index) => ({
      month:
        fallbackMonths[index],

      flowx,

      baseline:
        flowx * 0.62,
    }));

  const chartData =
    visibleTrend.length
      ? visibleTrend
      : fallbackTrend.slice(-chartRange);

  const chartMax =
    Math.max(
      ...chartData.map(
        (item) => item.flowx,
      ),
      1,
    );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="app-shell">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="sidebar">

        <div className="brand">
          <span className="brand-mark">
            F
          </span>

          <span>FLOWX</span>
        </div>

        {/* TENANT SWITCHER */}

        <div className="tenant-switcher">

          <span className="tenant-dot">
            {user.merchant_name
              ? user.merchant_name
                  .substring(0, 2)
                  .toUpperCase()
              : "AR"}
          </span>

          <span>
            <b>
              {user.merchant_name}
            </b>

            <small>
              Merchant workspace
            </small>
          </span>

          <ChevronDown size={15} />

        </div>

        {/* WORKSPACE NAVIGATION */}

        <nav className="nav-group">

          <p className="nav-label">
            WORKSPACE
          </p>

          {navItems.map(
            ({
              label,
              href,
              icon: Icon,
              active,
              count,
            }) => (
              <Link
                className={`nav-item ${
                  active ? "active" : ""
                }`}
                href={href}
                key={label}
              >
                <Icon size={17} />

                <span>
                  {label}
                </span>

                {count && (
                  <em>
                    {count}
                  </em>
                )}
              </Link>
            ),
          )}

        </nav>

        {/* CONTROL CENTER */}

        <nav className="nav-group lower-nav">

          <p className="nav-label">
            CONTROL CENTER
          </p>

          {systemItems.map(
            ({
              label,
              href,
              icon: Icon,
            }) => (
              <Link
                className="nav-item"
                href={href}
                key={label}
              >
                <Icon size={17} />

                <span>
                  {label}
                </span>
              </Link>
            ),
          )}

        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <div className="help-row">

            <LifeBuoy size={16} />

            <span>
              Help center
            </span>

          </div>

          <div className="profile">

            <span className="avatar">
              {user.full_name
                ? user.full_name
                    .split(" ")
                    .map(
                      (part) =>
                        part[0],
                    )
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "JD"}
            </span>

            <span>

              <b>
                {user.full_name}
              </b>

              <small>
                Finance admin
              </small>

            </span>

            <MoreHorizontal
              size={17}
            />

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN WORKSPACE
          ===================================================== */}

      <section className="workspace">

        {/* TOP BAR */}

        <header className="topbar">

          <div>

            <p className="breadcrumb">
              Workspace / Overview
            </p>

            <h1>
              Good morning,{" "}
              {user.full_name.split(
                " ",
              )[0]}

              <span>
                ✦
              </span>
            </h1>

          </div>

          <div className="top-actions">

            <div className="date-chip">

              <Clock3 size={15} />

              {todayLabel || "Today"}

              <ChevronDown
                size={14}
              />

            </div>

            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>

            <button
              className="logout"
              onClick={() => {
                logout();
                window.location.href =
                  "/login";
              }}
            >
              <LogOut size={16} />

              Log out
            </button>

          </div>

        </header>

        {/* ===================================================
            CONTENT
            =================================================== */}

        <div className="content">

          {/* NOTICE */}

          {notice && (
            <div className="toast">

              <Check size={16} />

              {notice}

              <button
                onClick={() =>
                  setNotice("")
                }
                aria-label="Close notification"
              >
                <X size={15} />
              </button>

            </div>
          )}

          {/* =================================================
              HERO
              ================================================= */}

          <div className="hero-row">

            <div>

              <p className="eyebrow">
                {todayLabel
                  ? todayLabel
                      .toUpperCase()
                  : "WORKSPACE OVERVIEW"}
              </p>

              <h2>
                Your cash, in motion.
              </h2>

              <p className="subhead">
                One clear view of what&apos;s
                at risk, what&apos;s moving,
                and where to act next.
              </p>

            </div>

            <button
              className="scenario-button"
              onClick={
                runScenario
              }
              disabled={
                scenarioRunning
              }
            >

              <Play
                size={15}
                fill="currentColor"
              />

              {scenarioRunning
                ? "Running scenario..."
                : "Run demo scenario"}

            </button>

          </div>

          {/* =================================================
              METRICS
              ================================================= */}

          <section className="metrics-grid">

            <Metric
              label="Total receivables"
              value={money(
                metrics.total_receivables,
              )}
              change="12.4%"
              icon={
                CircleDollarSign
              }
              note="vs. last month"
            />

            <Metric
              label="Cash recovered"
              value={money(
                metrics.cash_recovered,
              )}
              change="18.7%"
              icon={ArrowUpRight}
              note="vs. last month"
            />

            <Metric
              label="At risk"
              value={money(
                metrics.at_risk,
              )}
              change="8.2%"
              icon={Bell}
              note="of total receivables"
              negative
            />

            <Metric
              label="Promise-kept rate"
              value={`${metrics.promise_kept_rate}%`}
              change="3.1%"
              icon={
                ShieldCheck
              }
              note="last 30 days"
            />

          </section>

          {/* =================================================
              MAIN GRID
              ================================================= */}

          <section className="main-grid">

            {/* RECOVERY OVERVIEW */}

            <div className="panel recovery-panel">

              <div className="panel-heading">

                <div>

                  <p className="eyebrow">
                    CASH PERFORMANCE
                  </p>

                  <h3>
                    Recovery overview
                  </h3>

                </div>

                <label className="select-control">

                  <span className="sr-only">
                    Recovery period
                  </span>

                  <select
                    value={chartRange}
                    onChange={(
                      event,
                    ) =>
                      setChartRange(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                  >

                    <option value={12}>
                      Last 12 months
                    </option>

                    <option value={6}>
                      Last 6 months
                    </option>

                    <option value={3}>
                      Last 3 months
                    </option>

                  </select>

                  <ChevronDown
                    size={14}
                  />

                </label>

              </div>

              <div className="chart-summary">

                <div>

                  <span>
                    Recovered this year
                  </span>

                  <strong>
                    {money(
                      metrics.cash_recovered,
                    )}
                  </strong>

                  <small className="positive">

                    <ArrowUpRight
                      size={13}
                    />

                    Live from invoices

                  </small>

                </div>

                <div className="legend">

                  <span>
                    <i className="legend-flowx" />
                    FLOWX recovery
                  </span>

                  <span>
                    <i className="legend-baseline" />
                    Manual baseline
                  </span>

                </div>

              </div>

              <div className="bar-chart">

                {chartData.map(
                  (item) => (
                    <div
                      className="bar-column"
                      key={
                        item.month
                      }
                    >

                      <div className="bar-stack">

                        <span
                          className="baseline-bar"
                          style={{
                            height: `${
                              (item.baseline /
                                chartMax) *
                              100
                            }%`,
                          }}
                        />

                        <span
                          className="flowx-bar"
                          style={{
                            height: `${
                              (item.flowx /
                                chartMax) *
                              100
                            }%`,
                          }}
                        />

                      </div>

                      <small>
                        {item.month}
                      </small>

                    </div>
                  ),
                )}

              </div>

            </div>

            {/* RISK DISTRIBUTION */}

            <div className="panel risk-panel">

              <div className="panel-heading">

                <div>

                  <p className="eyebrow">
                    PORTFOLIO SIGNAL
                  </p>

                  <h3>
                    Risk distribution
                  </h3>

                </div>

                <button
                  className="more-button"
                  aria-label="More options"
                >
                  <MoreHorizontal
                    size={18}
                  />
                </button>

              </div>

              <div className="risk-total">

                <strong>
                  {money(
                    metrics.at_risk,
                  )}
                </strong>

                <span>
                  exposure at risk
                </span>

              </div>

              <div className="risk-bars">

                {[
                  "Critical",
                  "High",
                  "Medium",
                  "Low",
                ].map(
                  (tier) => {

                    const item =
                      riskDistribution.find(
                        (risk) =>
                          risk.risk_tier
                            .toLowerCase() ===
                          tier.toLowerCase(),
                      );

                    const exposure =
                      item?.exposure ||
                      0;

                    const width =
                      `${Math.min(
                        100,
                        (exposure /
                          Math.max(
                            metrics.at_risk,
                            1,
                          )) *
                          100,
                      )}%`;

                    return (
                      <RiskBar
                        key={tier}
                        label={tier}
                        value={money(
                          exposure,
                        )}
                        width={
                          width
                        }
                        tone={tier.toLowerCase()}
                      />
                    );
                  },
                )}

              </div>

              <div className="policy-callout">

                <ShieldCheck
                  size={17}
                />

                <span>

                  <b>
                    Policy engine active
                  </b>

                  <small>
                    All recommendations
                    are checked before
                    execution.
                  </small>

                </span>

                <Check
                  size={16}
                  className="check-icon"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              RECOVERY ACTIONS
              ================================================= */}

          <section className="panel actions-panel">

            <div className="panel-heading">

              <div>

                <p className="eyebrow">
                  ACTION QUEUE
                </p>

                <h3>

                  Recovery actions{" "}

                  <span className="count-badge">
                    {
                      dashboardActions.length
                    }{" "}
                    open
                  </span>

                </h3>

              </div>

              <Link
                href="/recovery"
                className="view-all"
              >
                View all actions{" "}
                <ArrowUpRight
                  size={15}
                />
              </Link>

            </div>

            <div className="table-wrap">

              <table>

                <thead>

                  <tr>

                    <th>
                      Action
                    </th>

                    <th>
                      Customer / invoice
                    </th>

                    <th>
                      Amount
                    </th>

                    <th>
                      Risk
                    </th>

                    <th>
                      Recommended workflow
                    </th>

                    <th>
                      Status
                    </th>

                    <th />

                  </tr>

                </thead>

                <tbody>

                  {dashboardActions.map(
                    (action) => (

                      <tr
                        key={
                          action.id
                        }
                      >

                        <td>

                          <b className="action-id">
                            {action.id}
                          </b>

                        </td>

                        <td>

                          <b>
                            {
                              action.customer
                            }
                          </b>

                          <small>
                            {
                              action.invoice
                            }{" "}
                            ·{" "}
                            {
                              action.detail
                            }
                          </small>

                        </td>

                        <td>

                          <b>
                            {
                              action.amount
                            }
                          </b>

                        </td>

                        <td>

                          <span
                            className={`risk-pill ${action.tone}`}
                          >

                            <i />

                            {
                              action.risk
                            }

                          </span>

                        </td>

                        <td>

                          <span className="workflow">

                            <Sparkles
                              size={14}
                            />

                            {action.risk ===
                            "Critical"
                              ? "Escalation + legal freeze"
                              : action.risk ===
                                "High"
                              ? "Early-pay discount + promise"
                              : action.risk ===
                                "Medium"
                              ? "Scheduled promise commitment"
                              : "Payment link reminder"}

                          </span>

                        </td>

                        <td>

                          {approved.includes(
                            action.id,
                          ) ? (

                            <span className="status-pill approved">

                              <Check
                                size={13}
                              />

                              Approved

                            </span>

                          ) : (

                            <span
                              className={`status-pill ${
                                action.status ===
                                "Needs approval"
                                  ? "needs-approval"
                                  : ""
                              }`}
                            >
                              {
                                action.status
                              }
                            </span>

                          )}

                        </td>

                        <td>

                          {action.status ===
                            "Needs approval" &&
                          !approved.includes(
                            action.id,
                          ) ? (

                            <button
                              className="approve-button"
                              onClick={() => {

                                const backendId =
                                  action.backendId;

                                if (
                                  !backendId
                                ) {
                                  setNotice(
                                    "This action cannot be approved because its backend ID is missing.",
                                  );

                                  return;
                                }

                                approveAction(
                                  backendId,
                                )
                                  .then(
                                    () => {

                                      setApproved(
                                        (
                                          previous,
                                        ) => [
                                          ...previous,
                                          action.id,
                                        ],
                                      );

                                      setNotice(
                                        `${action.id} approved. Execution remains policy-gated.`,
                                      );

                                    },
                                  )
                                  .catch(
                                    () => {
                                      setNotice(
                                        "Approval was blocked by policy.",
                                      );
                                    },
                                  );
                              }}
                            >
                              Approve
                            </button>

                          ) : (

                            <button
                              className="row-more"
                              aria-label="More options"
                            >
                              <MoreHorizontal
                                size={17}
                              />
                            </button>

                          )}

                        </td>

                      </tr>

                    ),
                  )}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              FOOTER
              ================================================= */}

          <footer className="footer-note">

            <span>

              <span className="live-dot" />

              All systems operational

            </span>

            <span>
              Last synced just now
            </span>

          </footer>

        </div>

      </section>

    </main>
  );
}

/* =========================================================
   METRIC COMPONENT
   ========================================================= */

function Metric({
  label,
  value,
  change,
  icon: Icon,
  note,
  negative = false,
}: {
  label: string;
  value: string;
  change: string;
  icon: typeof CircleDollarSign;
  note: string;
  negative?: boolean;
}) {
  return (
    <div className="metric-card">

      <div className="metric-top">

        <span>
          {label}
        </span>

        <Icon size={18} />

      </div>

      <strong>
        {value}
      </strong>

      <div
        className={`metric-change ${
          negative
            ? "negative"
            : ""
        }`}
      >

        <ArrowUpRight
          size={14}
        />

        {change}

        <small>
          {note}
        </small>

      </div>

    </div>
  );
}

/* =========================================================
   RISK BAR COMPONENT
   ========================================================= */

function RiskBar({
  label,
  value,
  width,
  tone,
}: {
  label: string;
  value: string;
  width: string;
  tone: string;
}) {
  return (
    <div className="risk-row">

      <div>

        <span>

          <i
            className={`risk-dot ${tone}`}
          />

          {label}

        </span>

        <b>
          {value}
        </b>

      </div>

      <div className="track">

        <span
          className={tone}
          style={{
            width,
          }}
        />

      </div>

    </div>
  );
}