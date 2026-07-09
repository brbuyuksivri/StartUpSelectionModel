const http = require('node:http');
const { HOST, PORT } = require('./api.config');
const { handleApiRequest } = require('./api.app');

function createAppServer() {
  return http.createServer((req, res) => handleApiRequest(req, res, { allowStatic: true }));
}

async function startServer() {
  const server = createAppServer();
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error?.code === 'EADDRINUSE') {
        error.message = `Port ${PORT} is already in use on ${HOST}. Stop the existing process or start with a different PORT.`;
      }
      reject(error);
    };
    server.once('error', onError);
    server.listen(PORT, HOST, () => {
      server.removeListener('error', onError);
      console.log(`VC Scouting server running at http://${HOST}:${PORT}`);
      resolve(server);
    });
  });
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
