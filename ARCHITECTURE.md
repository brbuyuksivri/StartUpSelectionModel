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
- `scoring-core.js`
  - shared scoring logic
- `worker.js`
  - async worker scaffold

## Why this structure now

The environment currently blocks creating nested monorepo folders, so the first modular pass is implemented as flat root modules. The module boundaries mirror the future monorepo layout and can be moved later without changing the logic shape.

## Next architecture steps

1. Split startup, scorecard, weights, evaluations, and analytics into dedicated API services
2. Move frontend metric/scoring logic out of `app.js` and into `scoring-core.js`
3. Add a real worker queue contract for AI evaluations
4. Replace SQLite with PostgreSQL and add migrations
