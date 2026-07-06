function createSnapshotService(deps) {
  return {
    saveSnapshot(snapshot) {
      return deps.saveSnapshot(snapshot);
    },
    resetSnapshot() {
      deps.seedDb();
      return deps.readSnapshot();
    },
    exportSnapshot() {
      return deps.readSnapshot();
    },
    importSnapshot(snapshot) {
      return deps.saveSnapshot(snapshot);
    },
  };
}

module.exports = { createSnapshotService };
