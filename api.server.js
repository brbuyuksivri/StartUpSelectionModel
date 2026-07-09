const http = require('node:http');
const { HOST, PORT } = require('./api.config');
const { handleApiRequest } = require('./api.app');

function createAppServer() {
  return http.createServer((req, res) => handleApiRequest(req, res, { allowStatic: true }));
}

async function startServer() {
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
