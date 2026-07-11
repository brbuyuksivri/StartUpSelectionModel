function createModelService(deps) {
  return {
    async get() {
      const snapshot = await deps.readSnapshot();
      return snapshot.model;
    },
    async update(model) {
      return deps.saveModel(model);
    },
  };
}

module.exports = { createModelService };
