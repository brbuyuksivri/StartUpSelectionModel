const { handleApiRequest } = require('./api.app');

module.exports = async function handler(req, res) {
  return handleApiRequest(req, res, { allowStatic: true });
};
