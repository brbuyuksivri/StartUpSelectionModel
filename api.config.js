const path = require('node:path');

const ROOT = __dirname;

module.exports = {
  ROOT,
  HOST: '127.0.0.1',
  PORT: Number(process.env.PORT || 8000),
  DATA_FILE: path.join(ROOT, 'data', 'vc_scouting.json'),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/vc_scouting',
  MIME: {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
  },
};
