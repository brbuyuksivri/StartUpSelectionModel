# VC Scouting Platform Architecture

## Current modular target

- `server.js`
  - compatibility entrypoint
- `api.server.js`
  - HTTP server bootstrap
- `api.config.js`
  - runtime config
- `api.database.js`
  - persistence and snapshot storage
- `api.bootstrap.service.js`
  - bootstrap read service
- `api.snapshot.service.js`
  - snapshot save/reset/import/export service
- `startups.service.js`
  - startup domain service
- `scorecards.service.js`
  - scorecard domain service
- `weights.service.js`
  - weights domain service
- `evaluations.service.js`
  - synchronous evaluation domain service
- `analytics.service.js`
  - portfolio analytics domain service
- `evaluation-jobs.service.js`
  - async evaluation queue service
- `ai-evaluator.openai.service.js`
  - OpenAI-backed analyst-note evaluator
- `scoring-core.js`
  - shared scoring logic, including analyst/external/AI score blending
- `worker.js`
  - async evaluation worker

## Why this structure now

The environment currently blocks creating nested monorepo folders, so the first modular pass is implemented as flat root modules. The module boundaries mirror the future monorepo layout and can be moved later without changing the logic shape.

## Completed steps

1. Split startup, scorecard, weights, evaluations, and analytics into dedicated API services
2. Move shared scoring logic into `scoring-core.js`
3. Add a real worker queue contract for async evaluations
4. Replace snapshot-only local persistence with PostgreSQL-backed APIs and migrations

## Next architecture steps

1. Replace remaining snapshot admin endpoints with scorecard/model version endpoints
2. Add provider-backed AI evaluation execution behind the queue
3. Move the flat root modules into a real monorepo layout (`apps/`, `packages/`)
4. Add auth/role enforcement around admin and portfolio mutation routes
