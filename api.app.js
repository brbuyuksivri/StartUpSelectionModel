const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const {
  ROOT,
  MIME,
  DATABASE_URL,
} = require('./api.config');
  const {
    initDb,
    readSnapshot,
    saveSnapshot,
    seedDb,
    listCandidates,
    saveCandidate,
    updateCandidate,
    deleteCandidate,
    listScorecards,
    listWeightSets,
    applyWeights,
    saveEvaluation,
    listEvaluations,
  } = require('./api.database');
const { createBootstrapService } = require('./api.bootstrap.service');
const { createSnapshotService } = require('./api.snapshot.service');
const { createStartupsService } = require('./startups.service');
const { createScorecardsService } = require('./scorecards.service');
const { createWeightsService } = require('./weights.service');
const { createEvaluationsService } = require('./evaluations.service');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(req.body || null);
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

let servicesPromise = null;

async function getServices() {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      await initDb();
      return {
        bootstrapService: createBootstrapService({ readSnapshot }),
        snapshotService: createSnapshotService({ readSnapshot, saveSnapshot, seedDb }),
        startupsService: createStartupsService({ listCandidates, saveCandidate, updateCandidate, deleteCandidate }),
        scorecardsService: createScorecardsService({ listScorecards }),
        weightsService: createWeightsService({ listWeightSets, readSnapshot, applyWeights }),
        evaluationsService: createEvaluationsService({ listEvaluations, readSnapshot, saveEvaluation }),
      };
    })().catch((error) => {
      servicesPromise = null;
      throw error;
    });
  }
  return servicesPromise;
}

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function internalErrorBody(error) {
  const message = error?.message || 'Internal server error';
  const details = [];
  if (!DATABASE_URL) details.push('DATABASE_URL is not configured.');
  return {
    error: message,
    details,
  };
}

async function handleApiRequest(req, res, options = {}) {
  const { allowStatic = false } = options;
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  if (!isApiPath(pathname)) {
    if (allowStatic) {
      sendStatic(pathname, res);
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const {
      bootstrapService,
      snapshotService,
      startupsService,
      scorecardsService,
      weightsService,
      evaluationsService,
    } = await getServices();

    if (req.method === 'GET' && pathname === '/api/health') {
      json(res, 200, { ok: true, service: 'vc-api', database: Boolean(DATABASE_URL) });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/bootstrap') {
      json(res, 200, await bootstrapService.getBootstrap());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/snapshot') {
      const payload = await readBody(req);
      json(res, 200, await snapshotService.saveSnapshot(payload));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/reset') {
      json(res, 200, await snapshotService.resetSnapshot());
      return;
    }

    if (req.method === 'GET' && pathname === '/api/export') {
      json(res, 200, await snapshotService.exportSnapshot());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/import') {
      const payload = await readBody(req);
      json(res, 200, await snapshotService.importSnapshot(payload));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/startups') {
      json(res, 200, await startupsService.list());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/startups') {
      const payload = await readBody(req);
      json(res, 200, await startupsService.save(payload));
      return;
    }

    if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/startups/')) {
      const id = decodeURIComponent(pathname.split('/').pop());
      const payload = await readBody(req);
      json(res, 200, await startupsService.update(id, payload || {}));
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/startups/')) {
      const id = decodeURIComponent(pathname.split('/').pop());
      json(res, 200, await startupsService.remove(id));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/scorecards') {
      json(res, 200, await scorecardsService.list());
      return;
    }

    if (req.method === 'GET' && pathname === '/api/scorecards/active') {
      json(res, 200, await scorecardsService.getActive());
      return;
    }

    if (req.method === 'GET' && pathname === '/api/weights') {
      json(res, 200, await weightsService.list());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/weights/preview') {
      const payload = await readBody(req);
      json(res, 200, await weightsService.preview(payload || {}));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/weights/apply') {
      const payload = await readBody(req);
      json(res, 200, await weightsService.apply(payload || {}));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/evaluations') {
      json(res, 200, await evaluationsService.list());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/evaluations/run') {
      const payload = await readBody(req);
      json(res, 200, await evaluationsService.evaluateStartup(payload?.startupId));
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    json(res, 500, internalErrorBody(error));
  }
}

module.exports = {
  handleApiRequest,
};
