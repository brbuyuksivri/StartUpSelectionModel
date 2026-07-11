const scoringCore = require('./scoring-core');

function createWeightsService(deps) {
  return {
    async list() {
      return deps.listWeightSets();
    },
    async preview(draftWeights) {
      const snapshot = await deps.readSnapshot();
      const currentMetrics = snapshot.model.metrics || [];
      const draftMetrics = currentMetrics.map((metric) => ({
        ...metric,
        weight: draftWeights[metric.column] ?? metric.weight,
      }));
      return scoringCore.previewWeightImpact(snapshot.candidates, currentMetrics, draftMetrics);
    },
    async apply(draftWeights) {
      const applied = await deps.applyWeights(draftWeights);
      return {
        ok: true,
        weights: applied,
      };
    },
  };
}

module.exports = { createWeightsService };
