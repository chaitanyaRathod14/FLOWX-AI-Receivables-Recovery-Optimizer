# 🚀 FLOWX Deployment Guide (Render + Vercel)

This guide walks you through deploying the complete FLOWX AI Receivables Recovery Optimizer stack:
1. **Backend (FastAPI)** on **Render**
2. **Frontend (Next.js)** on **Vercel**

---

## 📦 Architecture Overview

- **Backend**: FastAPI + Supabase PostgreSQL + Uvicorn (Hosted on Render)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + Lucide (Hosted on Vercel)
- **Database**: Supabase Postgres project with project URL, anon key, service role key, and DB connection string
- **Repository**: [FLOWX-AI-Receivables-Recovery-Optimizer](https://github.com/chaitanyaRathod14/FLOWX-AI-Receivables-Recovery-Optimizer)

---

## 🟢 Part 1: Deploy Backend on Render

### Method A: 1-Click / Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository: chaitanyaRathod14/FLOWX-AI-Receivables-Recovery-Optimizer.
4. Render will automatically detect 
ender.yaml and configure everything.
5. Click **Apply**.

---

### Method B: Manual Web Service Setup
If you prefer setting up manually:
1. In Render, click **New +** > **Web Service**.
2. Select repository: chaitanyaRathod14/FLOWX-AI-Receivables-Recovery-Optimizer.
3. Configure the following settings:
   - **Name**: lowx-backend
   - **Region**: Oregon (or nearest to you)
   - **Branch**: main
   - **Root Directory**: *(Leave empty / root)*
   - **Runtime**: Python 3
   - **Build Command**: pip install -r backend/requirements.txt
   - **Start Command**: python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 
   - **Plan**: Free

4. Add **Environment Variables**:
   | Variable | Value | Notes |
   |---|---|---|
   | PYTHON_VERSION | 3.11.9 | Python runtime version |
   | DEMO_MODE | true | Pre-seeds demo tenant data |
   | FLOWX_JWT_SECRET | *(Generate or set a secure 32+ char string)* | Used for session JWTs |
   | CORS_ORIGINS | http://localhost:3000 *(update after Vercel deploy)* | Comma-separated allowed URLs |
   | SUPABASE_URL | https://<project-ref>.supabase.co | Project URL from Supabase |
   | SUPABASE_ANON_KEY | <anon_key> | Browser-safe public key |
   | SUPABASE_SERVICE_ROLE_KEY | <service_role_key> | Server-side secret, keep private |
   | DATABASE_URL | postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres | Primary Postgres connection string |
   | SUPABASE_DB_URL | postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres | Kept consistent with DATABASE_URL |

5. Click **Create Web Service**.
6. Wait 2–3 minutes for the build to finish.
7. Copy your Render Backend URL (e.g., https://flowx-backend.onrender.com).
   - Test it by visiting https://flowx-backend.onrender.com/ in your browser. You will see:
     {status: online, service: FLOWX AI Receivables Recovery Optimizer API, ...}

---

## ⚡ Part 2: Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Click **Add New...** > **Project**.
3. Import the GitHub repository: chaitanyaRathod14/FLOWX-AI-Receivables-Recovery-Optimizer.
4. Configure the project:
   - **Framework Preset**: Next.js (automatically detected)
   - **Root Directory**: ./ (leave default)
   - **Build Command**: 
ext build (leave default)
   - **Output Directory**: .next (leave default)

5. Expand **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | NEXT_PUBLIC_API_URL | https://flowx-backend.onrender.com *(your Render backend URL from Part 1)* |

   > ⚠️ **Important**: Do not include a trailing slash in the URL.

6. Click **Deploy**.
7. Vercel will build and deploy the Next.js app in ~1 minute.
8. Click the preview domain (e.g., https://flowx-receivables.vercel.app).

---

## 🔄 Part 3: Connect & Update CORS

1. Copy your new Vercel frontend URL (e.g., https://flowx-receivables.vercel.app).
2. Go to your **Render Dashboard** > **flowx-backend** > **Environment**.
3. Update or set CORS_ORIGINS:
   `
   http://localhost:3000,https://flowx-receivables.vercel.app
   `
   *(Note: The backend also has automatic regex matching for all *.vercel.app preview and production deployments).*
4. Render will automatically redeploy with the updated CORS policy.

---

## 🔑 Demo Login Credentials

Once deployed, you can immediately log into the live app with:
- **Email**: jordan@acmereceivables.com
- **Password**: demo1234
- Or register a new account on /register!
