function createBootstrapService(deps) {
  return {
    getBootstrap() {
      return deps.readSnapshot();
    },
  };
}

module.exports = { createBootstrapService };
