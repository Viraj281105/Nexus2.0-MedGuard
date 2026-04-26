"use client";

// ---------------------------------------------------------------------------
// app/history/page.tsx — Case History Page
// ---------------------------------------------------------------------------
// Displays all past insurance appeal cases with status, denial info, and
// quick-access actions. Fetches from backend API with fallback to mock data.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { addToast } from "@/lib/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppealStatus = "approved" | "pending" | "rejected";

interface HistoryEntry {
  session_id: string;
  patient_name: string;
  procedure_denied: string;
  denial_code: string;
  status: AppealStatus;
  date: string;
  hospital: string;
  insurer: string;
}

// ---------------------------------------------------------------------------
// Mock data (used when API is unavailable)
// ---------------------------------------------------------------------------

const MOCK_HISTORY: HistoryEntry[] = [
  {
    session_id: "sess-001",
    patient_name: "Viraj Jadhao",
    procedure_denied: "Laparoscopic Appendectomy",
    denial_code: "RC-04",
    status: "pending",
    date: "2026-04-26",
    hospital: "Apollo Hospitals, Pune",
    insurer: "Star Health",
  },
  {
    session_id: "sess-002",
    patient_name: "Priya Sharma",
    procedure_denied: "MRI Brain (Contrast)",
    denial_code: "RC-07",
    status: "approved",
    date: "2026-04-18",
    hospital: "Fortis Hospital, Mumbai",
    insurer: "HDFC Ergo",
  },
  {
    session_id: "sess-003",
    patient_name: "Rajan Mehta",
    procedure_denied: "Physiotherapy — Post Knee Replacement",
    denial_code: "RC-12",
    status: "rejected",
    date: "2026-04-10",
    hospital: "Kokilaben Hospital, Mumbai",
    insurer: "Niva Bupa",
  },
  {
    session_id: "sess-004",
    patient_name: "Aisha Khan",
    procedure_denied: "CT Thorax (Contrast)",
    denial_code: "RC-07",
    status: "approved",
    date: "2026-03-29",
    hospital: "Manipal Hospital, Bengaluru",
    insurer: "Star Health",
  },
  {
    session_id: "sess-005",
    patient_name: "Suresh Pillai",
    procedure_denied: "Coronary Angioplasty (PTCA)",
    denial_code: "RC-04",
    status: "pending",
    date: "2026-03-15",
    hospital: "Narayana Health, Bengaluru",
    insurer: "Care Health Insurance",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  AppealStatus,
  { label: string; dot: string; badge: string; text: string }
> = {
  approved: {
    label: "Approved",
    dot: "#22c55e",
    badge: "rgba(34,197,94,0.12)",
    text: "#22c55e",
  },
  pending: {
    label: "Pending",
    dot: "#f59e0b",
    badge: "rgba(245,158,11,0.12)",
    text: "#f59e0b",
  },
  rejected: {
    label: "Rejected",
    dot: "#ef4444",
    badge: "rgba(239,68,68,0.12)",
    text: "#ef4444",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: AppealStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "999px",
        background: cfg.badge,
        color: cfg.text,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

function DenialCodeChip({ code }: { code: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        background: "rgba(99,102,241,0.15)",
        color: "#818cf8",
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "monospace",
        letterSpacing: "0.05em",
        border: "1px solid rgba(99,102,241,0.25)",
      }}
    >
      {code}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 20px",
        gap: "16px",
        color: "#64748b",
      }}
    >
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <p style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>No cases found</p>
      <p style={{ fontSize: "13px", margin: 0 }}>Start a new appeal to see it here.</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 120px 100px 130px 80px",
        gap: "16px",
        padding: "18px 24px",
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {[180, 160, 80, 60, 80, 60].map((w, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: w,
            borderRadius: 6,
            background: "rgba(255,255,255,0.06)",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AppealStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [usingMock, setUsingMock] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching — tries API first, falls back to mock
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/sessions`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: HistoryEntry[] = await res.json();
        setEntries(data);
        setUsingMock(false);
      } catch {
        // Fall back to mock data silently
        setEntries(MOCK_HISTORY);
        setUsingMock(true);
        addToast("Using demo data — backend unavailable", "warning");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------
  const filtered = entries.filter((e) => {
    const matchesStatus = filter === "all" || e.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.patient_name.toLowerCase().includes(q) ||
      e.procedure_denied.toLowerCase().includes(q) ||
      e.denial_code.toLowerCase().includes(q) ||
      e.hospital.toLowerCase().includes(q) ||
      e.insurer.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const counts = {
    all: entries.length,
    approved: entries.filter((e) => e.status === "approved").length,
    pending: entries.filter((e) => e.status === "pending").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #090e1a;
          color: #e2e8f0;
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .history-row {
          display: grid;
          grid-template-columns: 1fr 1fr 120px 100px 130px 80px;
          gap: 16px;
          padding: 16px 24px;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s ease;
          cursor: pointer;
          animation: fadeSlideIn 0.3s ease both;
          text-decoration: none;
          color: inherit;
        }
        .history-row:hover {
          background: rgba(99,102,241,0.07);
        }

        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          background: transparent;
          color: #94a3b8;
        }
        .filter-pill:hover {
          color: #e2e8f0;
          background: rgba(255,255,255,0.05);
        }
        .filter-pill.active {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.4);
          color: #818cf8;
        }

        .search-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 9px 14px 9px 38px;
          color: #e2e8f0;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          width: 260px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .search-input::placeholder { color: #475569; }
        .search-input:focus { border-color: rgba(99,102,241,0.5); }

        .col-header {
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .mock-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 8px;
          color: #fbbf24;
          font-size: 12px;
          margin-bottom: 20px;
        }

        .new-case-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          background: #4f46e5;
          color: white;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s ease;
          border: none;
          cursor: pointer;
        }
        .new-case-btn:hover { background: #4338ca; }

        .stat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 16px 20px;
          flex: 1;
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>

        {/* ----------------------------------------------------------------- */}
        {/* Header                                                             */}
        {/* ----------------------------------------------------------------- */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              Case History
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
              All insurance appeal cases processed by MedGuard
            </p>
          </div>
          <link href="/" className="new-case-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Case
          </link>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Mock data warning                                                  */}
        {/* ----------------------------------------------------------------- */}
        {usingMock && (
          <div className="mock-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Showing demo data — connect the backend to see real cases
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Stat cards                                                         */}
        {/* ----------------------------------------------------------------- */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {(["all", "approved", "pending", "rejected"] as const).map((s) => {
            const cfg = s === "all"
              ? { label: "Total Cases", color: "#6366f1" }
              : { label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].dot };
            return (
              <div key={s} className="stat-card">
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {loading ? "—" : counts[s]}
                </div>
              </div>
            );
          })}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Filters + Search                                                   */}
        {/* ----------------------------------------------------------------- */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "approved", "pending", "rejected"] as const).map((s) => (
              <button
                key={s}
                className={`filter-pill ${filter === s ? "active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
                <span style={{
                  background: filter === s ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.07)",
                  borderRadius: "999px",
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {loading ? "·" : counts[s]}
                </span>
              </button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-input"
              placeholder="Search patient, procedure, insurer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Table                                                              */}
        {/* ----------------------------------------------------------------- */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 120px 100px 130px 80px",
            gap: 16,
            padding: "12px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
          }}>
            {["Patient", "Procedure Denied", "Denial Code", "Status", "Hospital / Insurer", "Date"].map((h) => (
              <span key={h} className="col-header">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            filtered.map((entry, i) => (
              <a
                key={entry.session_id}
                href={`/case/${entry.session_id}`}
                className="history-row"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* Patient */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{entry.patient_name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{entry.session_id}</div>
                </div>

                {/* Procedure */}
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.4 }}>
                  {entry.procedure_denied}
                </div>

                {/* Denial code */}
                <div><DenialCodeChip code={entry.denial_code} /></div>

                {/* Status */}
                <div><StatusBadge status={entry.status} /></div>

                {/* Hospital / Insurer */}
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{entry.hospital}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{entry.insurer}</div>
                </div>

                {/* Date */}
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatDate(entry.date)}
                </div>
              </a>
            ))
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Footer count                                                       */}
        {/* ----------------------------------------------------------------- */}
        {!loading && filtered.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#475569", textAlign: "right" }}>
            Showing {filtered.length} of {entries.length} cases
          </div>
        )}
      </div>
    </>
  );
}