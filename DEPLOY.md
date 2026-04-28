# Prompt Audit Tracker — Deploy Guide

Two parts: **Backend** (Railway) + **Frontend** (Vercel).
Total time: ~20 minutes.

---

## PART 1 — Backend (Railway)

### Step 1: Create GitHub repo for backend

```bash
cd prompt-audit-backend
git init
git add .
git commit -m "init prompt audit api"
# Create a new repo on GitHub: prompt-audit-api
git remote add origin https://github.com/YOUR_USERNAME/prompt-audit-api.git
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select your `prompt-audit-api` repo
3. Railway auto-detects Node.js — click **Deploy**

### Step 3: Add PostgreSQL

1. In your Railway project → **+ New** → **Database** → **PostgreSQL**
2. Railway automatically sets `DATABASE_URL` in your service env ✓

### Step 4: Set environment variables

In Railway → your API service → **Variables** tab, add:

| Key | Value |
|-----|-------|
| `ADMIN_KEY` | `PromptAudit2026` (or your own secret) |
| `ALLOWED_ORIGINS` | `https://audit.velcro.dev,http://localhost:5173` |
| `NODE_ENV` | `production` |

> `DATABASE_URL` is already set automatically by Railway.

### Step 5: Get your API URL

Railway → your service → **Settings** → **Domains** → copy the URL.
It looks like: `https://prompt-audit-api-production-xxxx.up.railway.app`

Test it:
```bash
curl https://YOUR_RAILWAY_URL/health
# Should return: {"status":"ok","service":"prompt-audit-api"}
```

---

## PART 2 — Frontend (Vercel)

### Step 1: Scaffold Vite app

```bash
npm create vite@latest prompt-audit-frontend -- --template react
cd prompt-audit-frontend
```

### Step 2: Add the App component

Replace `src/App.jsx` with the file from this repo.
Replace `src/main.jsx` with:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

Delete `src/index.css` and `src/App.css` (not needed).
In `index.html`, update the title to `Prompt Audit Tracker`.

### Step 3: Set env variables

Create `.env` in the frontend root:

```
VITE_API_URL=https://YOUR_RAILWAY_URL.up.railway.app
VITE_ADMIN_KEY=PromptAudit2026
```

### Step 4: Test locally

```bash
npm install
npm run dev
# Open http://localhost:5173
```

### Step 5: Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

When prompted:
- Set up project: **Y**
- Which scope: your account
- Link to existing project: **N**
- Project name: `prompt-audit`
- Directory: `.` (current)

### Step 6: Add env variables in Vercel

Vercel Dashboard → your project → **Settings** → **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | your Railway URL |
| `VITE_ADMIN_KEY` | `PromptAudit2026` |

Then redeploy: `vercel --prod`

### Step 7: Custom domain (optional)

Vercel → **Settings** → **Domains** → add `audit.velcro.dev`
Then in GoDaddy, add a CNAME record:
- Name: `audit`
- Value: `cname.vercel-dns.com`

---

## Done ✓

Your audit tracker is live at `https://audit.velcro.dev`

**Admin key:** `PromptAudit2026` (stored in env, never in code)

**Delete an entry via curl:**
```bash
curl -X DELETE https://YOUR_RAILWAY_URL/api/entries/ENTRY_ID \
  -H 'x-admin-key: PromptAudit2026'
```

**Export all entries as CSV:**
```
https://YOUR_RAILWAY_URL/api/entries/export/csv
(requires x-admin-key header)
```
