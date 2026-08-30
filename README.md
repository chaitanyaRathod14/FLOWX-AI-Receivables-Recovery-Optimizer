This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

FLOWX

FLOWX is a working local receivables recovery application. The project is now configured for a Supabase PostgreSQL database, with a SQLite compatibility fallback during the legacy SQL migration.

## Environment setup

Copy the sample env files and replace the placeholder values with your own Supabase project credentials:

```powershell
copy .env.example .env
copy .env.example .env.local
```

Required variables include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `FLOWX_JWT_SECRET`
- `CORS_ORIGINS`

## Supabase database migration

Use the schema definition in `backend/app/supabase_schema.sql` to create the tables in your Supabase project. The app still contains legacy SQLite-specific SQL calls in `backend/app/main.py`, so the remaining step is a full SQL translation before the backend can operate exclusively against Postgres/Supabase.

## Run locally

Install backend dependencies and start the API:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

In a second terminal, start the client:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Demo login is automatic with `DEMO_MODE=true` and uses `jordan@acmereceivables.com` / `demo1234`.

The API docs are available at `http://localhost:8000/docs`.

## Working workflows

- Dashboard metrics and recovery actions are loaded from SQLite through `/dashboard`.
- Approval and execution are separate API operations and are policy-gated.
- Promise-to-pay creation and payment webhook processing are persisted.
- Webhook event IDs are unique and duplicate events are ignored.
- Audit records are written for approvals, execution, payments, policy changes, and demo runs.
- Registering a new merchant creates an isolated tenant and default policy.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
