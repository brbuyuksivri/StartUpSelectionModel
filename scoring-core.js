(function attachScoringCore(globalFactory) {
  const api = globalFactory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.VCScoringCore = api;
  }
})(function createScoringCore() {
  function toNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function createWeightsMap(metrics) {
    return Object.fromEntries(metrics.map((metric) => [metric.column, Number(metric.weight) || 0]));
  }

  function metricSourceScores(candidate, column) {
    return {
      analyst: toNumber(candidate.scores?.[column]),
      external: toNumber(candidate.externalScores?.[column]),
      ai: toNumber(candidate.aiScores?.[column]),
    };
  }

  function resolveMetricScore(candidate, column) {
    const sources = metricSourceScores(candidate, column);
    const values = Object.values(sources).filter((value) => value !== null);
    if (!values.length) return null;
    return average(values);
  }

  function metricColumnsByGroup(metrics) {
    return metrics.reduce((groups, metric) => {
      const key = metric.group || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(metric.column);
      return groups;
    }, {});
  }

  function computeScoresWithWeights(candidate, weights, groups = {}) {
    const nonFinancialColumns = groups.nonFinancial || ['B', 'C', 'D', 'E', 'F'];
    const financialColumns = groups.financial || ['G', 'H', 'I', 'J', 'K'];
    const intuitionColumns = groups.intuition || ['L'];

    const sum = (columns) => columns.reduce((total, column) => total + (resolveMetricScore(candidate, column) ?? 0) * (weights[column] ?? 0), 0);
    const nonFinancial = sum(nonFinancialColumns);
    const financial = sum(financialColumns);
    const intuition = sum(intuitionColumns);

    return {
      nonFinancial,
      financial,
      intuition,
      total: nonFinancial + financial + intuition,
    };
  }

  function computeCandidate(candidate, metrics, groups = metricColumnsByGroup(metrics)) {
    return computeScoresWithWeights(candidate, createWeightsMap(metrics), groups);
  }

  function computePortfolio(candidates, metrics, groups = metricColumnsByGroup(metrics)) {
    return candidates.map((candidate) => ({
      ...candidate,
      computed: computeCandidate(candidate, metrics, groups),
    }));
  }

  function previewWeightImpact(candidates, currentMetrics, draftMetrics, groups = metricColumnsByGroup(currentMetrics)) {
    const current = computePortfolio(candidates, currentMetrics, groups).sort((a, b) => b.computed.total - a.computed.total);
    const draft = computePortfolio(candidates, draftMetrics, groups).sort((a, b) => b.computed.total - a.computed.total);
    const currentRank = new Map(current.map((candidate, index) => [candidate.id, index + 1]));

    return draft.map((candidate, index) => {
      const before = currentRank.get(candidate.id) || index + 1;
      return {
        id: candidate.id,
        name: candidate.name,
        before,
        after: index + 1,
        movement: before - (index + 1),
        total: candidate.computed.total,
      };
    });
  }

  function maxPossibleTotal(metrics, maxScore = 5) {
    return metrics.reduce((sum, metric) => sum + maxScore * (Number(metric.weight) || 0), 0);
  }

  function pointQuality(candidate, metrics) {
    const total = metrics.length || 1;
    const scoreFilled = metrics.filter((metric) => toNumber(candidate.scores?.[metric.column]) !== null).length;
    const noteFilled = metrics.filter((metric) => (candidate.notes?.[metric.column] || '').trim().length > 0).length;
    const coverage = scoreFilled / total;
    const confidence = Math.min(1, coverage * 0.6 + (noteFilled / total) * 0.4);
    return { coverage, confidence };
  }

  return {
    toNumber,
    average,
    median,
    createWeightsMap,
    metricColumnsByGroup,
    computeScoresWithWeights,
    computeCandidate,
    computePortfolio,
    previewWeightImpact,
    maxPossibleTotal,
    pointQuality,
    metricSourceScores,
    resolveMetricScore,
  };
});
