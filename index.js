require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : "*",
}));
app.use(express.json());

function requireAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      id          TEXT PRIMARY KEY,
      timestamp   BIGINT NOT NULL,
      user_name   TEXT NOT NULL DEFAULT 'Anonymous',
      model       TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'General',
      risk        TEXT NOT NULL DEFAULT 'Low',
      prompt      TEXT NOT NULL,
      response_summary TEXT,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_risk ON audit_entries(risk);
    CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_entries(category);
  `);
  console.log("✓ Database ready");
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "prompt-audit-api", timestamp: Date.now() });
});

app.get("/api/entries", requireAdminKey, async (req, res) => {
  try {
    const { category, risk, search, limit = 500, offset = 0 } = req.query;
    let where = [], params = [], i = 1;
    if (category && category !== "All") { where.push(`category = $${i++}`); params.push(category); }
    if (risk && risk !== "All") { where.push(`risk = $${i++}`); params.push(risk); }
    if (search) { where.push(`(prompt ILIKE $${i} OR user_name ILIKE $${i})`); params.push(`%${search}%`); i++; }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM audit_entries ${whereClause} ORDER BY timestamp DESC LIMIT $${i} OFFSET $${i+1}`, [...params, limit, offset]);
    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_entries ${whereClause}`, params);
    res.json({ entries: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to fetch entries" }); }
});

app.get("/api/stats", requireAdminKey, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [total, high, todayCount, byCategory, byRisk] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM audit_entries"),
      pool.query("SELECT COUNT(*) FROM audit_entries WHERE risk = 'High'"),
      pool.query("SELECT COUNT(*) FROM audit_entries WHERE timestamp >= $1", [today.getTime()]),
      pool.query("SELECT category, COUNT(*) as count FROM audit_entries GROUP BY category ORDER BY count DESC"),
      pool.query("SELECT risk, COUNT(*) as count FROM audit_entries GROUP BY risk"),
    ]);
    res.json({ total: parseInt(total.rows[0].count), high_risk: parseInt(high.rows[0].count), today: parseInt(todayCount.rows[0].count), by_category: byCategory.rows, by_risk: byRisk.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to fetch stats" }); }
});

app.post("/api/entries", requireAdminKey, async (req, res) => {
  try {
    const { prompt, response_summary = "", category = "General", risk = "Low", user_name = "Anonymous", model = "claude-sonnet-4-20250514", notes = "" } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: "prompt is required" });
    const id = uuidv4();
    const timestamp = Date.now();
    const result = await pool.query(
      `INSERT INTO audit_entries (id,timestamp,user_name,model,category,risk,prompt,response_summary,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, timestamp, user_name.trim()||"Anonymous", model, category, risk, prompt.trim(), response_summary.trim(), notes.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to create entry" }); }
});

app.delete("/api/entries/:id", requireAdminKey, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM audit_entries WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Entry not found" });
    res.json({ deleted: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to delete entry" }); }
});

app.get("/api/entries/export/csv", requireAdminKey, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM audit_entries ORDER BY timestamp DESC");
    const headers = ["id","timestamp","user_name","model","category","risk","prompt","response_summary","notes"];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...result.rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="prompt-audit-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to export" }); }
});

// Start server first, then try DB
app.listen(PORT, () => {
  console.log(`✓ Prompt Audit API running on port ${PORT}`);
  console.log(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`);
  initDB().catch(err => console.error("DB init error:", err.message));
});
