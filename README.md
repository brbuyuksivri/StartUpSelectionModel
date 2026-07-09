# VC Scouting Web App

A web app that reproduces the scoring behavior of `VC_Scouting.xlsx`, exposes the internal metric notes/rubrics in an easier UI, and now persists app data through a PostgreSQL-backed API layer that can run locally or through Vercel serverless routes.

## What it does

- Rebuilds the Excel scoring model (weighted non-financial + financial + intuition score)
- Loads the existing candidate data from the Excel workbook
- Shows an Excel-style portfolio scatter chart (`Non-Financial` vs `Financial`)
- Supports inline editing of candidate scores and weights
- Shows per-candidate rationale notes (from `Internal_Info_DB` sheet)
- Includes metric scoring rubrics (criteria text used in the model)
- Persists model and candidate data in PostgreSQL through a local API server
- Keeps only UI preferences in the browser (`localStorage`)
- Supports JSON import/export for scenario sharing
- Exposes portfolio analytics and async evaluation job APIs for future AI workflows
- Supports multi-source scoring per metric: analyst, external user, and AI-derived score
- Runs OpenAI-backed startup note evaluation through the async job queue when configured

## Files

- `/index.html` - App shell
- `/styles.css` - UI styling
- `/client.js` - Scoring engine + interactivity
- `/server.js` - compatibility entrypoint for the modular API server
- `/api.app.js` - shared API route handler for local server and Vercel serverless
- `/api.server.js` - modular HTTP server bootstrap
- `/api/[...route].js` - Vercel serverless entrypoint for `/api/*`
- `/api.database.js` - PostgreSQL persistence layer
- `/api.bootstrap.service.js` - bootstrap snapshot service
- `/api.snapshot.service.js` - snapshot save/reset/import/export service
- `/startups.service.js` - startup domain service
- `/scorecards.service.js` - scorecard domain service
- `/weights.service.js` - weights domain service
- `/evaluations.service.js` - evaluations domain service
- `/analytics.service.js` - portfolio analytics service
- `/evaluation-jobs.service.js` - async evaluation queue service
- `/ai-evaluator.openai.service.js` - OpenAI-backed metric evaluator
- `/scoring-core.js` - shared scoring logic for backend/frontend migration
- `/worker.js` - async evaluation worker
- `/data/vc_scouting.json` - Extracted workbook data used by the app
- `/migration.0001_initial.sql` - initial PostgreSQL schema migration
- `/migration.0002_evaluation_jobs.sql` - evaluation job queue schema
- `/migration.0003_multisource_scores.sql` - external + AI score slot schema
- `/migrate.js` - PostgreSQL migration runner
- `/scripts/extract_vc_scouting.py` - Extracts data from the source Excel (`.xlsx` XML)
- `/ARCHITECTURE.md` - current modular target and migration notes
- `/vercel.json` - Vercel routing for static frontend + serverless API

## Run locally

From this folder:

```bash
npm install
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/vc_scouting
export OPENAI_API_KEY=your_openai_api_key
export OPENAI_MODEL=gpt-4.1-mini
node migrate.js
node server.js
```

Then open:

- [http://127.0.0.1:8000](http://127.0.0.1:8000)

The first run expects PostgreSQL to be available through `DATABASE_URL`. Migrations create the schema, and the API seeds the tables from `/data/vc_scouting.json` if the database is empty.

## Deploy on Vercel

Set at least:

```bash
vercel env add DATABASE_URL
vercel env add OPENAI_API_KEY
vercel env add OPENAI_MODEL
```

Without `DATABASE_URL`, the frontend can still fall back to the bundled JSON seed, but API-backed persistence endpoints will return a non-crashing `500` JSON error instead of crashing the serverless function.
Without `OPENAI_API_KEY`, queued AI evaluation jobs will fail with a clear runtime error instead of silently falling back to placeholder scoring.

## Regenerate data from the Excel file

The extractor currently reads:

- `/Users/borabuyuksivri/Desktop/180 DC/VC_Scouting.xlsx`

Run:

```bash
python3 scripts/extract_vc_scouting.py
```

This rewrites `/data/vc_scouting.json`.

## Notes on the PDFs

The provided metric PDFs appear to be non-trivial to text-extract in this environment, but the workbook's `Internal_Info_DB` sheet already contains the rubric criteria and metric rationale used by the scoring model, which this app imports and displays.
