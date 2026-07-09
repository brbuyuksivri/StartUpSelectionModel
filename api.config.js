const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/vc_scouting';

function loadEnvFile(filename) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeDatabaseUrl(rawValue) {
  if (!rawValue) return '';
  try {
    const url = new URL(rawValue);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    url.searchParams.delete('uselibpqcompat');
    return url.toString();
  } catch {
    return rawValue;
  }
}

function shouldUseSsl(rawValue) {
  if (!rawValue) return false;
  try {
    const url = new URL(rawValue);
    if (url.searchParams.get('sslmode') === 'disable') return false;
    return !['127.0.0.1', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
}

const RAW_DATABASE_URL = process.env.DATABASE_URL || (process.env.VERCEL ? '' : DEFAULT_LOCAL_DATABASE_URL);
const DATABASE_URL = sanitizeDatabaseUrl(RAW_DATABASE_URL);
const HAS_DATABASE_URL = Boolean(RAW_DATABASE_URL);
const DATABASE_CONFIG = HAS_DATABASE_URL ? {
  connectionString: DATABASE_URL,
  ssl: shouldUseSsl(RAW_DATABASE_URL) ? { rejectUnauthorized: true } : undefined,
  max: toNumber(process.env.PG_MAX_CONNECTIONS, process.env.VERCEL ? 5 : 10),
  idleTimeoutMillis: toNumber(process.env.PG_IDLE_TIMEOUT_MS, 10_000),
  connectionTimeoutMillis: toNumber(process.env.PG_CONNECTION_TIMEOUT_MS, 10_000),
  allowExitOnIdle: !process.env.VERCEL,
} : null;

module.exports = {
  ROOT,
  HOST: '127.0.0.1',
  PORT: Number(process.env.PORT || 8000),
  DATA_FILE: path.join(ROOT, 'data', 'vc_scouting.json'),
  RAW_DATABASE_URL,
  DATABASE_URL,
  HAS_DATABASE_URL,
  DATABASE_CONFIG,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  MIME: {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
  },
};
