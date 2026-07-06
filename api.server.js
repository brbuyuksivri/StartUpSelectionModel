const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { ROOT, HOST, PORT, MIME } = require('./api.config');
const { initDb, readSnapshot, saveSnapshot, seedDb, listCandidates, saveCandidate, deleteCandidate, listScorecards, listWeightSets, saveEvaluation, listEvaluations } = require('./api.database');
const { createBootstrapService } = require('./api.bootstrap.service');
const { createSnapshotService } = require('./api.snapshot.service');
const { createStartupsService } = require('./startups.service');
const { createScorecardsService } = require('./scorecards.service');
const { createWeightsService } = require('./weights.service');
const { createEvaluationsService } = require('./evaluations.service');

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendStatic(reqPath, res) {
  const pathname = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    json(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function createAppServer() {
  const bootstrapService = createBootstrapService({ readSnapshot });
  const snapshotService = createSnapshotService({ readSnapshot, saveSnapshot, seedDb });
  const startupsService = createStartupsService({ listCandidates, saveCandidate, deleteCandidate });
  const scorecardsService = createScorecardsService({ listScorecards });
  const weightsService = createWeightsService({ listWeightSets, readSnapshot });
  const evaluationsService = createEvaluationsService({ listEvaluations, readSnapshot, saveEvaluation });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, { ok: true, service: 'vc-api' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
      json(res, 200, await bootstrapService.getBootstrap());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/snapshot') {
      try {
        const payload = await readBody(req);
        json(res, 200, snapshotService.saveSnapshot(payload));
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reset') {
      try {
        json(res, 200, snapshotService.resetSnapshot());
      } catch (error) {
        json(res, 500, { error: error.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/export') {
      json(res, 200, await snapshotService.exportSnapshot());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/import') {
      try {
        const payload = await readBody(req);
        json(res, 200, snapshotService.importSnapshot(payload));
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/startups') {
      json(res, 200, await startupsService.list());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/startups') {
      try {
        const payload = await readBody(req);
        json(res, 200, await startupsService.save(payload));
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/startups/')) {
      try {
        const id = decodeURIComponent(url.pathname.split('/').pop());
        json(res, 200, await startupsService.remove(id));
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/scorecards') {
      json(res, 200, await scorecardsService.list());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/scorecards/active') {
      json(res, 200, await scorecardsService.getActive());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/weights') {
      json(res, 200, await weightsService.list());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/weights/preview') {
      try {
        const payload = await readBody(req);
        json(res, 200, await weightsService.preview(payload || {}));
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/evaluations') {
      json(res, 200, await evaluationsService.list());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/evaluations/run') {
      try {
        const payload = await readBody(req);
        json(res, 200, await evaluationsService.evaluateStartup(payload?.startupId));
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    sendStatic(url.pathname, res);
  });
}

async function startServer() {
  await initDb();
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`VC Scouting server running at http://${HOST}:${PORT}`);
  });
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createAppServer,
  startServer,
};
