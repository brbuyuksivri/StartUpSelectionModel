const scoringCore = require('./scoring-core');

function createEvaluationsService(deps) {
  return {
    async list() {
      return deps.listEvaluations();
    },
    async evaluateStartup(startupId) {
      const snapshot = await deps.readSnapshot();
      const startup = snapshot.candidates.find((candidate) => candidate.id === startupId);
      if (!startup) throw new Error('Startup not found');

      const computed = scoringCore.computeCandidate(startup, snapshot.model.metrics || []);
      const evaluation = {
        id: `eval_${Date.now()}`,
        startupId,
        summary: {
          computed,
          generatedAt: new Date().toISOString(),
          source: 'system',
        },
      };
      await deps.saveEvaluation(evaluation);
      return evaluation;
    },
  };
}

module.exports = { createEvaluationsService };
