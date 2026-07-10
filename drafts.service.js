function createDraftsService(deps) {
  return {
    async list(prefix) {
      return deps.listWorkflowDrafts(prefix || '');
    },
    async get(workflowKey) {
      return deps.getWorkflowDraft(workflowKey);
    },
    async save(workflowKey, payload) {
      if (!payload) return deps.deleteWorkflowDraft(workflowKey).then(() => null);
      return deps.saveWorkflowDraft(workflowKey, payload);
    },
    async remove(workflowKey) {
      await deps.deleteWorkflowDraft(workflowKey);
      return { ok: true, workflowKey };
    },
  };
}

module.exports = { createDraftsService };
