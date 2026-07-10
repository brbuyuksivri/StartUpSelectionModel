const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { DATA_FILE, DATABASE_CONFIG, HAS_DATABASE_URL, ROOT } = require('./api.config');
const { computePortfolio } = require('./scoring-core');

const pool = DATABASE_CONFIG ? new Pool(DATABASE_CONFIG) : null;
let initPromise = null;
const NEW_STARTUP_DRAFT_KEY = 'new-startup';
const NEW_STARTUP_DRAFT_PREFIX = 'new-startup:';

function readSeed() {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return {
    source: raw.source || null,
    model: raw.model,
    candidates: raw.candidates || [],
  };
}

function normalizeCandidate(candidate, index = null) {
  return {
    id: candidate.id || `seed_${index ?? Math.random().toString(36).slice(2, 8)}`,
    sourceIndex: candidate.sourceIndex ?? index,
    name: candidate.name || 'Unnamed candidate',
    normalizedName: candidate.normalizedName || '',
    scores: candidate.scores || {},
    externalScores: candidate.externalScores || {},
    aiScores: candidate.aiScores || {},
    aiRationales: candidate.aiRationales || {},
    notes: candidate.notes || {},
    computedFromExcel: candidate.computedFromExcel || null,
    isNew: Boolean(candidate.isNew),
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    stage: candidate.stage || 'sourcing',
    lastAiEvaluationId: candidate.lastAiEvaluationId || null,
  };
}

async function query(sql, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool.query(sql, params);
}

async function getConfigValue(key) {
  const { rows } = await query('SELECT value FROM app_config WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

async function getWorkflowDraft(workflowKey) {
  const { rows } = await query(`
    SELECT workflow_key, payload_json, created_at, updated_at
    FROM workflow_drafts
    WHERE workflow_key = $1
    LIMIT 1
  `, [workflowKey]);
  if (!rows[0]) return null;
  const payload = rows[0].payload_json || {};
  return {
    workflowKey: rows[0].workflow_key,
    ...payload,
    meta: {
      ...(payload.meta || {}),
      savedAt: payload?.meta?.savedAt || rows[0].updated_at,
    },
  };
}

async function listWorkflowDrafts(prefix = '') {
  const clauses = [];
  const params = [];
  if (prefix) {
    params.push(`${prefix}%`);
    clauses.push(`workflow_key LIKE $${params.length}`);
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(`
    SELECT workflow_key, payload_json, created_at, updated_at
    FROM workflow_drafts
    ${whereSql}
    ORDER BY updated_at DESC, created_at DESC
  `, params);
  return rows.map((row) => {
    const payload = row.payload_json || {};
    return {
      workflowKey: row.workflow_key,
      ...payload,
      meta: {
        ...(payload.meta || {}),
        draftId: payload?.meta?.draftId || row.workflow_key.replace(NEW_STARTUP_DRAFT_PREFIX, ''),
        savedAt: payload?.meta?.savedAt || row.updated_at,
      },
    };
  });
}

async function saveWorkflowDraft(workflowKey, payload, clientOverride = null) {
  const executor = clientOverride || pool;
  if (!executor) throw new Error('DATABASE_URL is not configured');
  if (!workflowKey) throw new Error('workflowKey is required');
  if (!payload) {
    await executor.query('DELETE FROM workflow_drafts WHERE workflow_key = $1', [workflowKey]);
    return null;
  }
  await executor.query(`
    INSERT INTO workflow_drafts (workflow_key, payload_json)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (workflow_key) DO UPDATE
    SET payload_json = EXCLUDED.payload_json,
        updated_at = NOW()
  `, [workflowKey, JSON.stringify(payload)]);
  return getWorkflowDraft(workflowKey);
}

async function deleteWorkflowDraft(workflowKey) {
  await query('DELETE FROM workflow_drafts WHERE workflow_key = $1', [workflowKey]);
}

async function deleteWorkflowDraftsByPrefix(prefix, clientOverride = null) {
  const executor = clientOverride || pool;
  if (!executor) throw new Error('DATABASE_URL is not configured');
  await executor.query('DELETE FROM workflow_drafts WHERE workflow_key LIKE $1', [`${prefix}%`]);
}

async function seedDbWithClient(client) {
  const seed = readSeed();
  try {
    await client.query('INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['source', JSON.stringify(seed.source || null)]);
    await client.query('INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['model', JSON.stringify(seed.model)]);
    await client.query('DELETE FROM candidates');
    await client.query('DELETE FROM evaluations');
    await client.query('DELETE FROM workflow_drafts');
    for (const [index, rawCandidate] of seed.candidates.entries()) {
      const candidate = normalizeCandidate(rawCandidate, index);
      await client.query(`
        INSERT INTO candidates (
          id, source_index, name, normalized_name, scores_json, external_scores_json,
          ai_scores_json, ai_rationales_json, notes_json,
          computed_from_excel_json, is_new, tags_json, stage, last_ai_evaluation_id
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14)
      `, [
        candidate.id,
        candidate.sourceIndex,
        candidate.name,
        candidate.normalizedName,
        JSON.stringify(candidate.scores),
        JSON.stringify(candidate.externalScores),
        JSON.stringify(candidate.aiScores),
        JSON.stringify(candidate.aiRationales),
        JSON.stringify(candidate.notes),
        JSON.stringify(candidate.computedFromExcel),
        candidate.isNew,
        JSON.stringify(candidate.tags),
        candidate.stage,
        candidate.lastAiEvaluationId,
      ]);
    }

    await client.query(`
      INSERT INTO scorecards (id, name, is_active, config_json)
      VALUES ('default-scorecard', 'Default VC Scorecard', TRUE, $1::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, config_json = EXCLUDED.config_json
    `, [JSON.stringify(seed.model)]);

    await client.query(`
      INSERT INTO weight_sets (id, name, is_active, weights_json)
      VALUES ('default-weights', 'Default Weights', TRUE, $1::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, weights_json = EXCLUDED.weights_json
    `, [JSON.stringify(seed.model.weights || [])]);
  } catch (error) {
    throw error;
  }
}

async function seedDb() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedDbWithClient(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(client) {
  const files = fs.readdirSync(ROOT)
    .filter((file) => /^migration\.\d+_.+\.sql$/.test(file))
    .sort();

  await client.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const applied = await client.query('SELECT name FROM migration_history WHERE name = $1', [file]);
    if (applied.rowCount) continue;
    const sql = fs.readFileSync(path.join(ROOT, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO migration_history (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

async function initDb() {
  if (!HAS_DATABASE_URL || !pool) throw new Error('DATABASE_URL is not configured');
  if (!initPromise) {
    initPromise = (async () => {
      const client = await pool.connect();
      try {
        await runMigrations(client);
        const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM app_config');
        if (!rows[0]?.count) {
          await client.query('BEGIN');
          try {
            await seedDbWithClient(client);
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        }
      } finally {
        client.release();
      }
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function readSnapshot() {
  const model = await getConfigValue('model');
  const source = await getConfigValue('source');
  const [legacyDraft, prefixedDrafts] = await Promise.all([
    getWorkflowDraft(NEW_STARTUP_DRAFT_KEY),
    listWorkflowDrafts(NEW_STARTUP_DRAFT_PREFIX),
  ]);
  const newStartupDrafts = [...prefixedDrafts];
  if (legacyDraft) {
    const legacyId = legacyDraft?.meta?.draftId || 'legacy';
    if (!newStartupDrafts.some((draft) => (draft?.meta?.draftId || '') === legacyId)) {
      newStartupDrafts.push({
        ...legacyDraft,
        meta: {
          ...legacyDraft.meta,
          draftId: legacyId,
        },
      });
    }
  }
  newStartupDrafts.sort((a, b) => new Date(b?.meta?.savedAt || 0).getTime() - new Date(a?.meta?.savedAt || 0).getTime());
  const newStartupDraft = newStartupDrafts[0] || null;
  const { rows } = await query(`
    SELECT id, source_index, name, normalized_name, scores_json, external_scores_json,
           ai_scores_json, ai_rationales_json, notes_json,
           computed_from_excel_json, is_new, tags_json, stage, last_ai_evaluation_id
    FROM candidates
    ORDER BY COALESCE(source_index, 999999), name
  `);

  const candidates = rows.map((row) => ({
    id: row.id,
    sourceIndex: row.source_index,
    name: row.name,
    normalizedName: row.normalized_name || '',
    scores: row.scores_json || {},
    externalScores: row.external_scores_json || {},
    aiScores: row.ai_scores_json || {},
    aiRationales: row.ai_rationales_json || {},
    notes: row.notes_json || {},
    computedFromExcel: row.computed_from_excel_json || null,
    isNew: Boolean(row.is_new),
    tags: row.tags_json || [],
    stage: row.stage || 'sourcing',
    lastAiEvaluationId: row.last_ai_evaluation_id || null,
  }));

  return {
    source,
    model,
    candidates,
    newStartupDrafts,
    newStartupDraft,
    computed: computePortfolio(candidates, model.weights),
  };
}

async function saveSnapshot(snapshot) {
  if (!snapshot?.model || !Array.isArray(snapshot?.candidates)) throw new Error('Invalid snapshot payload');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['model', JSON.stringify(snapshot.model)]);
    await client.query('DELETE FROM candidates');
    for (const [index, rawCandidate] of snapshot.candidates.entries()) {
      const candidate = normalizeCandidate(rawCandidate, index);
      await client.query(`
        INSERT INTO candidates (
          id, source_index, name, normalized_name, scores_json, external_scores_json,
          ai_scores_json, ai_rationales_json, notes_json,
          computed_from_excel_json, is_new, tags_json, stage, last_ai_evaluation_id
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14)
      `, [
        candidate.id,
        candidate.sourceIndex,
        candidate.name,
        candidate.normalizedName,
        JSON.stringify(candidate.scores),
        JSON.stringify(candidate.externalScores),
        JSON.stringify(candidate.aiScores),
        JSON.stringify(candidate.aiRationales),
        JSON.stringify(candidate.notes),
        JSON.stringify(candidate.computedFromExcel),
        candidate.isNew,
        JSON.stringify(candidate.tags),
        candidate.stage,
        candidate.lastAiEvaluationId,
      ]);
    }
    await client.query(`
      INSERT INTO scorecards (id, name, is_active, config_json)
      VALUES ('default-scorecard', 'Default VC Scorecard', TRUE, $1::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET config_json = EXCLUDED.config_json, is_active = EXCLUDED.is_active
    `, [JSON.stringify(snapshot.model)]);
    await client.query(`
      INSERT INTO weight_sets (id, name, is_active, weights_json)
      VALUES ('default-weights', 'Default Weights', TRUE, $1::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET weights_json = EXCLUDED.weights_json, is_active = EXCLUDED.is_active
    `, [JSON.stringify(snapshot.model.weights || [])]);
    if (Array.isArray(snapshot.newStartupDrafts)) {
      await deleteWorkflowDraftsByPrefix(NEW_STARTUP_DRAFT_PREFIX, client);
      await saveWorkflowDraft(NEW_STARTUP_DRAFT_KEY, null, client);
      for (const draft of snapshot.newStartupDrafts) {
        const draftId = draft?.meta?.draftId || Math.random().toString(36).slice(2, 10);
        await saveWorkflowDraft(`${NEW_STARTUP_DRAFT_PREFIX}${draftId}`, {
          ...draft,
          meta: {
            ...(draft.meta || {}),
            draftId,
          },
        }, client);
      }
    } else if (Object.prototype.hasOwnProperty.call(snapshot, 'newStartupDraft')) {
      if (snapshot.newStartupDraft?.meta?.draftId) {
        await saveWorkflowDraft(`${NEW_STARTUP_DRAFT_PREFIX}${snapshot.newStartupDraft.meta.draftId}`, snapshot.newStartupDraft, client);
      } else {
        await saveWorkflowDraft(NEW_STARTUP_DRAFT_KEY, snapshot.newStartupDraft || null, client);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return readSnapshot();
}

async function listCandidates() {
  const snapshot = await readSnapshot();
  return snapshot.candidates;
}

async function saveCandidate(candidate) {
  const normalized = normalizeCandidate(candidate);
  await query(`
    INSERT INTO candidates (
      id, source_index, name, normalized_name, scores_json, external_scores_json,
      ai_scores_json, ai_rationales_json, notes_json,
      computed_from_excel_json, is_new, tags_json, stage, last_ai_evaluation_id
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14)
    ON CONFLICT (id) DO UPDATE SET
      source_index = EXCLUDED.source_index,
      name = EXCLUDED.name,
      normalized_name = EXCLUDED.normalized_name,
      scores_json = EXCLUDED.scores_json,
      external_scores_json = EXCLUDED.external_scores_json,
      ai_scores_json = EXCLUDED.ai_scores_json,
      ai_rationales_json = EXCLUDED.ai_rationales_json,
      notes_json = EXCLUDED.notes_json,
      computed_from_excel_json = EXCLUDED.computed_from_excel_json,
      is_new = EXCLUDED.is_new,
      tags_json = EXCLUDED.tags_json,
      stage = EXCLUDED.stage,
      last_ai_evaluation_id = EXCLUDED.last_ai_evaluation_id
  `, [
    normalized.id,
    normalized.sourceIndex,
    normalized.name,
    normalized.normalizedName,
    JSON.stringify(normalized.scores),
    JSON.stringify(normalized.externalScores),
    JSON.stringify(normalized.aiScores),
    JSON.stringify(normalized.aiRationales),
    JSON.stringify(normalized.notes),
    JSON.stringify(normalized.computedFromExcel),
    normalized.isNew,
    JSON.stringify(normalized.tags),
    normalized.stage,
    normalized.lastAiEvaluationId,
  ]);
  return normalized;
}

async function updateCandidate(id, patch) {
  const { rows } = await query(`
    SELECT id, source_index, name, normalized_name, scores_json, external_scores_json,
           ai_scores_json, ai_rationales_json, notes_json,
           computed_from_excel_json, is_new, tags_json, stage, last_ai_evaluation_id
    FROM candidates
    WHERE id = $1
    LIMIT 1
  `, [id]);
  if (!rows[0]) throw new Error('Startup not found');

  const current = {
    id: rows[0].id,
    sourceIndex: rows[0].source_index,
    name: rows[0].name,
    normalizedName: rows[0].normalized_name || '',
    scores: rows[0].scores_json || {},
    externalScores: rows[0].external_scores_json || {},
    aiScores: rows[0].ai_scores_json || {},
    aiRationales: rows[0].ai_rationales_json || {},
    notes: rows[0].notes_json || {},
    computedFromExcel: rows[0].computed_from_excel_json || null,
    isNew: Boolean(rows[0].is_new),
    tags: rows[0].tags_json || [],
    stage: rows[0].stage || 'sourcing',
    lastAiEvaluationId: rows[0].last_ai_evaluation_id || null,
  };

  return saveCandidate({
    ...current,
    ...patch,
    id: current.id,
  });
}

async function deleteCandidate(id) {
  await query('DELETE FROM candidates WHERE id = $1', [id]);
}

async function listScorecards() {
  const { rows } = await query('SELECT id, name, is_active, config_json FROM scorecards ORDER BY name');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    config: row.config_json,
  }));
}

async function listWeightSets() {
  const { rows } = await query('SELECT id, name, is_active, weights_json FROM weight_sets ORDER BY name');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    weights: row.weights_json,
  }));
}

async function applyWeights(draftWeights) {
  const snapshot = await readSnapshot();
  const currentWeights = snapshot.model.weights || [];
  const nextWeights = currentWeights.map((metric) => ({
    ...metric,
    weight: Number(draftWeights[metric.column] ?? metric.weight) || 0,
  }));
  const nextModel = {
    ...snapshot.model,
    weights: nextWeights,
  };

  await query('UPDATE app_config SET value = $2 WHERE key = $1', ['model', JSON.stringify(nextModel)]);
  await query(`
    INSERT INTO weight_sets (id, name, is_active, weights_json)
    VALUES ('default-weights', 'Default Weights', TRUE, $1::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET weights_json = EXCLUDED.weights_json,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
  `, [JSON.stringify(nextWeights)]);

  return nextWeights;
}

async function saveEvaluation(evaluation) {
  await query(`
    INSERT INTO evaluations (id, startup_id, summary_json)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      startup_id = EXCLUDED.startup_id,
      summary_json = EXCLUDED.summary_json,
      updated_at = NOW()
  `, [evaluation.id, evaluation.startupId, JSON.stringify(evaluation.summary)]);
  return evaluation;
}

async function listEvaluations() {
  const { rows } = await query('SELECT id, startup_id, summary_json, created_at, updated_at FROM evaluations ORDER BY updated_at DESC');
  return rows.map((row) => ({
    id: row.id,
    startupId: row.startup_id,
    summary: row.summary_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function listEvaluationJobs() {
  const { rows } = await query(`
    SELECT id, startup_id, status, payload_json, result_json, error_text, requested_by,
           created_at, started_at, completed_at, updated_at
    FROM evaluation_jobs
    ORDER BY created_at DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    startupId: row.startup_id,
    status: row.status,
    payload: row.payload_json || {},
    result: row.result_json || null,
    error: row.error_text || null,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }));
}

async function enqueueEvaluationJob(job) {
  await query(`
    INSERT INTO evaluation_jobs (id, startup_id, status, payload_json, requested_by)
    VALUES ($1, $2, $3, $4::jsonb, $5)
  `, [
    job.id,
    job.startupId,
    job.status || 'queued',
    JSON.stringify(job.payload || {}),
    job.requestedBy || 'system',
  ]);
  return job;
}

async function claimNextEvaluationJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, startup_id, status, payload_json, requested_by, created_at
      FROM evaluation_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    if (!rows[0]) {
      await client.query('COMMIT');
      return null;
    }

    const row = rows[0];
    await client.query(`
      UPDATE evaluation_jobs
      SET status = 'processing',
          started_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [row.id]);
    await client.query('COMMIT');
    return {
      id: row.id,
      startupId: row.startup_id,
      status: 'processing',
      payload: row.payload_json || {},
      requestedBy: row.requested_by,
      createdAt: row.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function completeEvaluationJob(id, result) {
  await query(`
    UPDATE evaluation_jobs
    SET status = 'completed',
        result_json = $2::jsonb,
        completed_at = NOW(),
        updated_at = NOW(),
        error_text = NULL
    WHERE id = $1
  `, [id, JSON.stringify(result || {})]);
}

async function failEvaluationJob(id, errorMessage) {
  await query(`
    UPDATE evaluation_jobs
    SET status = 'failed',
        error_text = $2,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [id, errorMessage || 'Unknown evaluation failure']);
}

module.exports = {
  pool,
  initDb,
  seedDb,
  readSnapshot,
  saveSnapshot,
  NEW_STARTUP_DRAFT_KEY,
  NEW_STARTUP_DRAFT_PREFIX,
  getWorkflowDraft,
  listWorkflowDrafts,
  saveWorkflowDraft,
  deleteWorkflowDraft,
  deleteWorkflowDraftsByPrefix,
  listCandidates,
  saveCandidate,
  updateCandidate,
  deleteCandidate,
  listScorecards,
  listWeightSets,
  applyWeights,
  saveEvaluation,
  listEvaluations,
  listEvaluationJobs,
  enqueueEvaluationJob,
  claimNextEvaluationJob,
  completeEvaluationJob,
  failEvaluationJob,
};
