function createStartupsService(deps) {
  return {
    async list() {
      return deps.listCandidates();
    },
    async save(candidate) {
      return deps.saveCandidate(candidate);
    },
    async update(id, patch) {
      return deps.updateCandidate(id, patch);
    },
    async remove(id) {
      await deps.deleteCandidate(id);
      return { ok: true, id };
    },
  };
}

module.exports = { createStartupsService };
