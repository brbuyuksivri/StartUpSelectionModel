const fs = require('node:fs');
const { Pool } = require('pg');
const { DATA_FILE, DATABASE_URL } = require('./api.config');
const { computePortfolio } = require('./scoring-core');

const pool = new Pool({ connectionString: DATABASE_URL });

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
    notes: candidate.notes || {},
    computedFromExcel: candidate.computedFromExcel || null,
    isNew: Boolean(candidate.isNew),
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    stage: candidate.stage || 'sourcing',
  };
}

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function getConfigValue(key) {
  const { rows } = await query('SELECT value FROM app_config WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

async function seedDb() {
  const seed = readSeed();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['source', JSON.stringify(seed.source || null)]);
    await client.query('INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['model', JSON.stringify(seed.model)]);
    await client.query('DELETE FROM candidates');
    await client.query('DELETE FROM evaluations');
    for (const [index, rawCandidate] of seed.candidates.entries()) {
      const candidate = normalizeCandidate(rawCandidate, index);
      await client.query(`
        INSERT INTO candidates (
          id, source_index, name, normalized_name, scores_json, notes_json,
          computed_from_excel_json, is_new, tags_json, stage
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10)
      `, [
        candidate.id,
        candidate.sourceIndex,
        candidate.name,
        candidate.normalizedName,
        JSON.stringify(candidate.scores),
        JSON.stringify(candidate.notes),
        JSON.stringify(candidate.computedFromExcel),
        candidate.isNew,
        JSON.stringify(candidate.tags),
        candidate.stage,
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

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function initDb() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM app_config');
  if (!rows[0]?.count) await seedDb();
}

async function readSnapshot() {
  const model = await getConfigValue('model');
  const source = await getConfigValue('source');
  const { rows } = await query(`
    SELECT id, source_index, name, normalized_name, scores_json, notes_json,
           computed_from_excel_json, is_new, tags_json, stage
    FROM candidates
    ORDER BY COALESCE(source_index, 999999), name
  `);

  const candidates = rows.map((row) => ({
    id: row.id,
    sourceIndex: row.source_index,
    name: row.name,
    normalizedName: row.normalized_name || '',
    scores: row.scores_json || {},
    notes: row.notes_json || {},
    computedFromExcel: row.computed_from_excel_json || null,
    isNew: Boolean(row.is_new),
    tags: row.tags_json || [],
    stage: row.stage || 'sourcing',
  }));

  return {
    source,
    model,
    candidates,
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
          id, source_index, name, normalized_name, scores_json, notes_json,
          computed_from_excel_json, is_new, tags_json, stage
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10)
      `, [
        candidate.id,
        candidate.sourceIndex,
        candidate.name,
        candidate.normalizedName,
        JSON.stringify(candidate.scores),
        JSON.stringify(candidate.notes),
        JSON.stringify(candidate.computedFromExcel),
        candidate.isNew,
        JSON.stringify(candidate.tags),
        candidate.stage,
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
      id, source_index, name, normalized_name, scores_json, notes_json,
      computed_from_excel_json, is_new, tags_json, stage
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10)
    ON CONFLICT (id) DO UPDATE SET
      source_index = EXCLUDED.source_index,
      name = EXCLUDED.name,
      normalized_name = EXCLUDED.normalized_name,
      scores_json = EXCLUDED.scores_json,
      notes_json = EXCLUDED.notes_json,
      computed_from_excel_json = EXCLUDED.computed_from_excel_json,
      is_new = EXCLUDED.is_new,
      tags_json = EXCLUDED.tags_json,
      stage = EXCLUDED.stage
  `, [
    normalized.id,
    normalized.sourceIndex,
    normalized.name,
    normalized.normalizedName,
    JSON.stringify(normalized.scores),
    JSON.stringify(normalized.notes),
    JSON.stringify(normalized.computedFromExcel),
    normalized.isNew,
    JSON.stringify(normalized.tags),
    normalized.stage,
  ]);
  return normalized;
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

module.exports = {
  pool,
  initDb,
  seedDb,
  readSnapshot,
  saveSnapshot,
  listCandidates,
  saveCandidate,
  deleteCandidate,
  listScorecards,
  listWeightSets,
  saveEvaluation,
  listEvaluations,
};
