function createSnapshotService(deps) {
  return {
    async saveSnapshot(snapshot) {
      return deps.saveSnapshot(snapshot);
    },
    async resetSnapshot() {
      await deps.seedDb();
      return deps.readSnapshot();
    },
    async exportSnapshot() {
      return deps.readSnapshot();
    },
    async importSnapshot(snapshot) {
      return deps.saveSnapshot(snapshot);
    },
  };
}

module.exports = { createSnapshotService };
