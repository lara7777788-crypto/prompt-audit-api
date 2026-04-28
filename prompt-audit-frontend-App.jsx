import { useState, useEffect, useCallback } from "react";

// ── Config ────────────────────────────────────────────────
// Set these in your .env file:
// VITE_API_URL=https://your-api.up.railway.app
// VITE_ADMIN_KEY=PromptAudit2026
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "";

const CATEGORIES = ["General", "Code", "Content", "Analysis", "Customer Service", "Compliance", "Other"];
const RISK_LEVELS = [
  { label: "Low", color: "#4ade80" },
  { label: "Medium", color: "#facc15" },
  { label: "High", color: "#f87171" },
];

const EMPTY_FORM = {
  prompt: "", response_summary: "", category: "General",
  risk: "Low", user_name: "", model: "claude-sonnet-4-20250514", notes: ""
};

// ── API helpers ───────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res;
}

// ── Helpers ───────────────────────────────────────────────
function formatTimestamp(ts) {
  return new Date(Number(ts)).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function riskColor(r) {
  return RISK_LEVELS.find(l => l.label === r)?.color || "#aaa";
}

// ── Styles ────────────────────────────────────────────────
const S = {
  input: {
    width: "100%", background: "#111", border: "1px solid #222", color: "#e5e5e5",
    padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box"
  },
  label: { fontSize: 10, letterSpacing: 2, color: "#444", marginBottom: 6, display: "block" },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? "#e5e5e5" : "none",
    color: variant === "primary" ? "#0a0a0a" : "#555",
    border: variant === "primary" ? "none" : "1px solid #222",
    padding: "12px 28px", fontSize: 11, letterSpacing: 2,
    fontFamily: "inherit", cursor: "pointer", fontWeight: variant === "primary" ? "bold" : "normal"
  }),
};

// ── Component ─────────────────────────────────────────────
export default function PromptAuditTracker() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ total: 0, high_risk: 0, today: 0 });
  const [view, setView] = useState("log");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ category: "All", risk: "All", search: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.category !== "All") params.set("category", filter.category);
      if (filter.risk !== "All") params.set("risk", filter.risk);
      if (filter.search) params.set("search", filter.search);

      const res = await apiFetch(`/api/entries?${params}`);
      const data = await res.json();
      setEntries(data.entries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Add entry
  const addEntry = async () => {
    if (!form.prompt.trim()) return;
    setLoading(true);
    try {
      await apiFetch("/api/entries", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(EMPTY_FORM);
      setView("log");
      await Promise.all([fetchEntries(), fetchStats()]);
      showToast("Entry logged.");
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Delete entry
  const deleteEntry = async (id) => {
    try {
      await apiFetch(`/api/entries/${id}`, { method: "DELETE" });
      if (selected?.id === id) { setSelected(null); setView("log"); }
      await Promise.all([fetchEntries(), fetchStats()]);
      showToast("Entry deleted.");
    } catch (err) {
      showToast(err.message, true);
    }
  };

  // Export CSV via API
  const exportCSV = async () => {
    const res = await fetch(`${API_URL}/api/entries/export/csv`, {
      headers: { "x-admin-key": ADMIN_KEY }
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `prompt-audit-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Courier New', monospace", background: "#0a0a0a",
      minHeight: "100vh", color: "#e5e5e5",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 999,
          background: "#1a1a1a", border: `1px solid ${toast.isError ? "#f87171" : "#333"}`,
          padding: "10px 18px", fontSize: 12, letterSpacing: 1,
          color: toast.isError ? "#f87171" : "#4ade80"
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222", padding: "18px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#555", marginBottom: 2 }}>VELA PROTOCOL / AUDIT</div>
          <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 1 }}>PROMPT AUDIT TRACKER</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 11, color: "#555" }}>
          {[
            { label: "TOTAL", val: stats.total, color: "#e5e5e5" },
            { label: "TODAY", val: stats.today, color: "#4ade80" },
            { label: "HIGH RISK", val: stats.high_risk, color: "#f87171" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, color: s.color, fontWeight: "bold" }}>{s.val}</div>
              <div style={{ letterSpacing: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "0 28px", display: "flex" }}>
        {["log", "add"].map(v => (
          <button key={v} onClick={() => { setView(v); setSelected(null); }} style={{
            background: "none", border: "none",
            borderBottom: view === v ? "2px solid #e5e5e5" : "2px solid transparent",
            color: view === v ? "#e5e5e5" : "#555", padding: "12px 20px",
            cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit"
          }}>
            {v === "log" ? "AUDIT LOG" : "+ LOG PROMPT"}
          </button>
        ))}
        {entries.length > 0 && (
          <button onClick={exportCSV} style={{
            background: "none", border: "none", color: "#555", padding: "12px 20px",
            cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit", marginLeft: "auto"
          }}>↓ EXPORT CSV</button>
        )}
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* ── ADD FORM ── */}
        {view === "add" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#555", marginBottom: 20 }}>NEW AUDIT ENTRY</div>

            {[
              { label: "USER / OPERATOR", key: "user_name", placeholder: "Who sent this prompt?" },
              { label: "MODEL", key: "model", placeholder: "claude-sonnet-4-20250514" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={S.label}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} style={S.input} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              {[
                { label: "CATEGORY", key: "category", options: CATEGORIES },
                { label: "RISK LEVEL", key: "risk", options: RISK_LEVELS.map(r => r.label) },
              ].map(f => (
                <div key={f.key} style={{ flex: 1 }}>
                  <label style={S.label}>{f.label}</label>
                  <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    style={{ ...S.input }}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {[
              { label: "PROMPT *", key: "prompt", placeholder: "Paste the full prompt here...", rows: 5 },
              { label: "RESPONSE SUMMARY", key: "response_summary", placeholder: "Brief summary of what the model returned...", rows: 3 },
              { label: "AUDITOR NOTES", key: "notes", placeholder: "Flags, concerns, context...", rows: 2 },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={S.label}>{f.label}</label>
                <textarea value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} rows={f.rows}
                  style={{ ...S.input, resize: "vertical" }} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={addEntry} disabled={loading} style={S.btn("primary")}>
                {loading ? "SAVING…" : "LOG ENTRY"}
              </button>
              <button onClick={() => setView("log")} style={S.btn("secondary")}>CANCEL</button>
            </div>
          </div>
        )}

        {/* ── LOG VIEW ── */}
        {view === "log" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <input value={filter.search}
                onChange={e => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search prompts or users…"
                style={{ ...S.input, flex: 1, minWidth: 160, width: "auto" }} />
              <select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })}
                style={{ ...S.input, width: "auto" }}>
                <option>All</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={filter.risk} onChange={e => setFilter({ ...filter, risk: e.target.value })}
                style={{ ...S.input, width: "auto" }}>
                <option>All</option>
                {RISK_LEVELS.map(r => <option key={r.label}>{r.label}</option>)}
              </select>
            </div>

            {error && (
              <div style={{ color: "#f87171", fontSize: 12, letterSpacing: 1, marginBottom: 16 }}>
                ⚠ {error} — check your API URL and admin key in .env
              </div>
            )}

            {loading && !entries.length ? (
              <div style={{ color: "#333", fontSize: 12, letterSpacing: 2, padding: "40px 0", textAlign: "center" }}>LOADING…</div>
            ) : entries.length === 0 ? (
              <div style={{ color: "#333", fontSize: 12, letterSpacing: 2, padding: "40px 0", textAlign: "center" }}>NO ENTRIES FOUND</div>
            ) : (
              <div>
                <div style={{
                  display: "grid", gridTemplateColumns: "160px 120px 100px 80px 1fr 36px",
                  gap: 12, padding: "8px 14px",
                  fontSize: 10, letterSpacing: 2, color: "#444", borderBottom: "1px solid #1a1a1a"
                }}>
                  <span>TIMESTAMP</span><span>USER</span><span>CATEGORY</span><span>RISK</span><span>PROMPT</span><span></span>
                </div>
                {entries.map(e => (
                  <div key={e.id}
                    onClick={() => { setSelected(e); setView("detail"); }}
                    style={{
                      display: "grid", gridTemplateColumns: "160px 120px 100px 80px 1fr 36px",
                      gap: 12, padding: "12px 14px", cursor: "pointer",
                      borderBottom: "1px solid #111", transition: "background 0.1s",
                    }}
                    onMouseEnter={ev => ev.currentTarget.style.background = "#111"}
                    onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: 11, color: "#555" }}>{formatTimestamp(e.timestamp)}</span>
                    <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.user_name}</span>
                    <span style={{ fontSize: 11, color: "#777" }}>{e.category}</span>
                    <span style={{
                      fontSize: 10, letterSpacing: 1, color: riskColor(e.risk),
                      border: `1px solid ${riskColor(e.risk)}33`, padding: "2px 6px",
                      display: "inline-block", width: "fit-content", height: "fit-content"
                    }}>{e.risk.toUpperCase()}</span>
                    <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#aaa" }}>
                      {e.prompt.slice(0, 90)}{e.prompt.length > 90 ? "…" : ""}
                    </span>
                    <button onClick={ev => { ev.stopPropagation(); deleteEntry(e.id); }}
                      style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 18, padding: 0 }}
                      onMouseEnter={ev => ev.target.style.color = "#f87171"}
                      onMouseLeave={ev => ev.target.style.color = "#333"}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DETAIL VIEW ── */}
        {view === "detail" && selected && (
          <div style={{ maxWidth: 680 }}>
            <button onClick={() => { setView("log"); setSelected(null); }} style={{
              background: "none", border: "none", color: "#555", cursor: "pointer",
              fontSize: 11, letterSpacing: 2, fontFamily: "inherit", padding: 0, marginBottom: 24
            }}>← BACK TO LOG</button>

            <div style={{ fontSize: 11, letterSpacing: 3, color: "#555", marginBottom: 4 }}>AUDIT ENTRY</div>
            <div style={{ fontSize: 10, color: "#2a2a2a", marginBottom: 24 }}>{selected.id}</div>

            {[
              ["TIMESTAMP", formatTimestamp(selected.timestamp)],
              ["USER / OPERATOR", selected.user_name],
              ["MODEL", selected.model],
              ["CATEGORY", selected.category],
            ].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 14, display: "flex", gap: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#444", width: 150, flexShrink: 0 }}>{label}</div>
                <div style={{ fontSize: 13 }}>{val}</div>
              </div>
            ))}

            <div style={{ marginBottom: 14, display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#444", width: 150, flexShrink: 0 }}>RISK LEVEL</div>
              <span style={{
                fontSize: 10, letterSpacing: 1, color: riskColor(selected.risk),
                border: `1px solid ${riskColor(selected.risk)}44`, padding: "3px 8px"
              }}>{selected.risk.toUpperCase()}</span>
            </div>

            {[
              ["PROMPT", selected.prompt],
              ["RESPONSE SUMMARY", selected.response_summary],
              ["AUDITOR NOTES", selected.notes],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#444", marginBottom: 8 }}>{label}</div>
                <div style={{
                  background: "#111", border: "1px solid #1a1a1a", padding: 14,
                  fontSize: 13, lineHeight: 1.7, color: "#ccc", whiteSpace: "pre-wrap"
                }}>{val}</div>
              </div>
            ))}

            <button onClick={() => deleteEntry(selected.id)} style={{
              background: "none", border: "1px solid #f8717122", color: "#f87171",
              padding: "10px 20px", fontSize: 11, letterSpacing: 2, fontFamily: "inherit", cursor: "pointer"
            }}>DELETE ENTRY</button>
          </div>
        )}
      </div>
    </div>
  );
}
