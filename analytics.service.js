const scoringCore = require('./scoring-core');

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildHistogram(values, bins = 8) {
  if (!values.length) return { labels: [], counts: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = Math.max(1, (max - min) / bins);
  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx] += 1;
  });
  return {
    labels: counts.map((_, i) => `${Math.round(min + i * step)}+`),
    counts,
  };
}

function createAnalyticsService(deps) {
  return {
    async getPortfolioAnalytics(options = {}) {
      const snapshot = await deps.readSnapshot();
      const candidates = snapshot.computed || scoringCore.computePortfolio(snapshot.candidates, snapshot.model.weights);
      if (!candidates.length) {
        return {
          generatedAt: new Date().toISOString(),
          counts: {
            candidates: 0,
            aboveTarget: 0,
            abovePartnerCutoff: 0,
          },
          thresholds: {
            nf: 0,
            f: 0,
            totalTarget: 0,
            partnerCutoff: 0,
          },
          summary: {
            averageTotal: 0,
            medianTotal: 0,
            averageNonFinancial: 0,
            averageFinancial: 0,
            top3Share: 0,
          },
          quadrants: {
            invest: 0,
            watchFinancial: 0,
            watchNonFinancial: 0,
            pass: 0,
          },
          distribution: { labels: [], counts: [] },
          ranking: [],
          opportunities: [],
          insights: {
            pipelineQuality: 'No startups are loaded yet.',
            dealflowBalance: 'Quadrant mix is unavailable until startups are loaded.',
            riskDispersion: 'Risk dispersion becomes available after the first scored startup.',
            convictionConcentration: 'Conviction concentration is unavailable without a ranked portfolio.',
            opportunity: 'No opportunity gap data available.',
          },
        };
      }

      const totals = candidates.map((candidate) => candidate.computed.total);
      const nfValues = candidates.map((candidate) => candidate.computed.nonFinancial);
      const fValues = candidates.map((candidate) => candidate.computed.financial);
      const maxTotal = scoringCore.maxPossibleTotal(snapshot.model.weights, 5);
      const requestedNf = parseOptionalNumber(options.nf);
      const requestedF = parseOptionalNumber(options.f);

      const thresholds = {
        nf: requestedNf !== null
          ? requestedNf
          : Math.round(scoringCore.average(nfValues)),
        f: requestedF !== null
          ? requestedF
          : Math.round(scoringCore.average(fValues)),
        totalTarget: Math.round(maxTotal * 0.7),
        partnerCutoff: Math.round(maxTotal * 0.82),
      };

      const quadrants = {
        invest: 0,
        watchFinancial: 0,
        watchNonFinancial: 0,
        pass: 0,
      };

      candidates.forEach((candidate) => {
        const topNF = candidate.computed.nonFinancial >= thresholds.nf;
        const topF = candidate.computed.financial >= thresholds.f;
        if (topNF && topF) quadrants.invest += 1;
        else if (!topNF && topF) quadrants.watchNonFinancial += 1;
        else if (topNF && !topF) quadrants.watchFinancial += 1;
        else quadrants.pass += 1;
      });

      const ranking = [...candidates]
        .sort((a, b) => b.computed.total - a.computed.total)
        .slice(0, 10)
        .map((candidate, index) => ({
          rank: index + 1,
          id: candidate.id,
          name: candidate.name,
          total: candidate.computed.total,
          nonFinancial: candidate.computed.nonFinancial,
          financial: candidate.computed.financial,
        }));

      const opportunities = [...candidates]
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          gap: Math.max(0, maxTotal - candidate.computed.total),
        }))
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 5);

      const top10 = ranking.reduce((sum, item) => sum + item.total, 0) || 1;
      const top3Share = Math.round((ranking.slice(0, 3).reduce((sum, item) => sum + item.total, 0) / top10) * 100);

      return {
        generatedAt: new Date().toISOString(),
        counts: {
          candidates: candidates.length,
          aboveTarget: totals.filter((value) => value >= thresholds.totalTarget).length,
          abovePartnerCutoff: totals.filter((value) => value >= thresholds.partnerCutoff).length,
        },
        thresholds,
        summary: {
          averageTotal: Number(scoringCore.average(totals).toFixed(1)),
          medianTotal: Math.round(scoringCore.median(totals)),
          averageNonFinancial: Number(scoringCore.average(nfValues).toFixed(1)),
          averageFinancial: Number(scoringCore.average(fValues).toFixed(1)),
          top3Share,
        },
        quadrants,
        distribution: buildHistogram(totals, 8),
        ranking,
        opportunities,
        insights: {
          pipelineQuality: `${totals.filter((value) => value >= thresholds.totalTarget).length}/${candidates.length} startups are above target, and ${totals.filter((value) => value >= thresholds.partnerCutoff).length}/${candidates.length} exceed partner cutoff.`,
          dealflowBalance: `${quadrants.invest} startups are in Invest, ${quadrants.watchFinancial + quadrants.watchNonFinancial} are in Watch, and ${quadrants.pass} are in Pass.`,
          riskDispersion: `${totals.filter((value) => value < thresholds.totalTarget).length} startups remain below target; de-risk those with strong market signal first.`,
          convictionConcentration: `Top 3 startups account for ${top3Share}% of top-10 conviction score.`,
          opportunity: opportunities[0]
            ? `${opportunities[0].name} has the largest weighted upside gap at ${Math.round(opportunities[0].gap)} points.`
            : 'No opportunity gap data available.',
        },
      };
    },
  };
}

module.exports = { createAnalyticsService };
