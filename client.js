const DATA_URL = '/api/bootstrap';
const FALLBACK_DATA_URL = './data/vc_scouting.json';
const EXPORT_URL = '/api/export';
const IMPORT_URL = '/api/import';
const RESET_URL = '/api/reset';
const SNAPSHOT_URL = '/api/snapshot';
const STARTUPS_URL = '/api/startups';
const DRAFTS_URL = '/api/drafts';
const ANALYTICS_PORTFOLIO_URL = '/api/analytics/portfolio';
const EVALUATION_JOBS_URL = '/api/evaluation-jobs';
const EVALUATIONS_URL = '/api/evaluations';
const WEIGHTS_PREVIEW_URL = '/api/weights/preview';
const WEIGHTS_APPLY_URL = '/api/weights/apply';
const STORAGE_KEY = 'vc-scouting-model-ui-v2';
const NEW_DRAFT_DEFAULTS = Object.freeze({
  draftId: '',
  name: '',
  template: 'balanced',
  clone: '',
  notesMode: 'empty',
  savedAt: null,
});
const NEW_STARTUP_DRAFT_PREFIX = 'new-startup:';
const scoringCore = globalThis.VCScoringCore;
const SCORE_OPTIONS = ['', 1, 2, 3, 4, 5];
const METRIC_NAME_LIST = [
  'Ekip Yapısı',
  'Ürün',
  'Ticarileşme',
  'İş Modeli',
  'Büyüme Potansiyeli (Ölçeklenebilme & Globalleşme)',
  'Pazar & Rakipler',
  'Finansallar',
  'Çıkış Stratejisi',
];

const els = {
  panes: [...document.querySelectorAll('.pane')],
  navBtns: [...document.querySelectorAll('.nav-btn')],
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),

  toggleScatterControls: document.getElementById('toggleScatterControls'),
  scatterControls: document.getElementById('scatterControls'),
  nfInput: document.getElementById('nfInput'),
  fInput: document.getElementById('fInput'),
  useAvg: document.getElementById('useAvg'),
  useMedian: document.getElementById('useMedian'),
  focusTopNearToggle: document.getElementById('focusTopNearToggle'),
  labelMode: document.getElementById('labelMode'),
  scatterCanvas: document.getElementById('scatterCanvas'),
  scatterLegend: document.getElementById('scatterLegend'),
  rankingCanvas: document.getElementById('rankingCanvas'),
  distCanvas: document.getElementById('distCanvas'),
  quadrantPieCanvas: document.getElementById('quadrantPieCanvas'),
  rankingContributionCanvas: document.getElementById('rankingContributionCanvas'),
  opportunityCanvas: document.getElementById('opportunityCanvas'),
  insightPipelineQuality: document.getElementById('insightPipelineQuality'),
  insightRiskDispersion: document.getElementById('insightRiskDispersion'),
  insightDealflowBalance: document.getElementById('insightDealflowBalance'),
  insightConvictionConcentration: document.getElementById('insightConvictionConcentration'),
  insightOpportunity: document.getElementById('insightOpportunity'),
  selectedStartupBrief: document.getElementById('selectedStartupBrief'),
  analysisActionBoard: document.getElementById('analysisActionBoard'),
  briefCompareBtn: document.getElementById('briefCompareBtn'),
  briefPipelineBtn: document.getElementById('briefPipelineBtn'),
  aiStartupSelect: document.getElementById('aiStartupSelect'),
  aiQueueBtn: document.getElementById('aiQueueBtn'),
  aiProcessNextBtn: document.getElementById('aiProcessNextBtn'),
  aiRefreshBtn: document.getElementById('aiRefreshBtn'),
  aiStatus: document.getElementById('aiStatus'),
  aiQueueSummary: document.getElementById('aiQueueSummary'),
  aiLatestEvaluation: document.getElementById('aiLatestEvaluation'),
  aiJobList: document.getElementById('aiJobList'),
  aiMetricSlots: document.getElementById('aiMetricSlots'),

  compareA: document.getElementById('compareA'),
  compareB: document.getElementById('compareB'),
  compareMode: document.getElementById('compareMode'),
  swapBtn: document.getElementById('swapBtn'),
  compareSummary: document.getElementById('compareSummary'),
  decisionSummary: document.getElementById('decisionSummary'),
  compareHeatmap: document.getElementById('compareHeatmap'),
  compareCanvas: document.getElementById('compareCanvas'),
  compareEvidence: document.getElementById('compareEvidence'),

  newDraftPicker: document.getElementById('newDraftPicker'),
  loadDraftBtn: document.getElementById('loadDraftBtn'),
  newDraftBtn: document.getElementById('newDraftBtn'),
  deleteDraftBtn: document.getElementById('deleteDraftBtn'),
  newName: document.getElementById('newName'),
  newTemplate: document.getElementById('newTemplate'),
  newClone: document.getElementById('newClone'),
  newNotesMode: document.getElementById('newNotesMode'),
  prefillBtn: document.getElementById('prefillBtn'),
  saveDraftBtn: document.getElementById('saveDraftBtn'),
  clearBtn: document.getElementById('clearBtn'),
  createBtn: document.getElementById('createBtn'),
  newDraftStatus: document.getElementById('newDraftStatus'),
  newFeedback: document.getElementById('newFeedback'),
  newMetrics: document.getElementById('newMetrics'),
  guideMetric: document.getElementById('guideMetric'),
  guideText: document.getElementById('guideText'),

  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  quadrantSelect: document.getElementById('quadrantSelect'),
  savedViewSelect: document.getElementById('savedViewSelect'),
  selectVisibleToggle: document.getElementById('selectVisibleToggle'),
  selectionStatus: document.getElementById('selectionStatus'),
  bulkTagInput: document.getElementById('bulkTagInput'),
  bulkStageSelect: document.getElementById('bulkStageSelect'),
  bulkTagBtn: document.getElementById('bulkTagBtn'),
  bulkStageBtn: document.getElementById('bulkStageBtn'),
  bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
  table: document.getElementById('table'),
  tableDetailPanel: document.getElementById('tableDetailPanel'),
  tableDetailCompareBtn: document.getElementById('tableDetailCompareBtn'),
  tableDetailQueueBtn: document.getElementById('tableDetailQueueBtn'),

  weightsContainer: document.getElementById('weightsContainer'),
  presetSelect: document.getElementById('presetSelect'),
  applyPresetBtn: document.getElementById('applyPresetBtn'),
  resetDraftWeightsBtn: document.getElementById('resetDraftWeightsBtn'),
  applyWeightsBtn: document.getElementById('applyWeightsBtn'),
  weightPreviewSummary: document.getElementById('weightPreviewSummary'),
  rubricMetric: document.getElementById('rubricMetric'),
  rubricText: document.getElementById('rubricText'),
};

const state = {
  original: null,
  model: null,
  candidates: [],
  activePane: 'analysis',
  scatterControlsOpen: false,
  thresholds: { nf: null, f: null },
  labelMode: 'smart',
  search: '',
  sort: 'total-desc',
  quadrant: 'all',
  savedView: 'all',
  compareA: null,
  compareB: null,
  compareMode: 'raw',
  newDraft: null,
  selectedRows: [],
  selectedTableStartupId: null,
  draftWeights: {},
  weightPreset: 'balanced',
  scatterPoints: [],
  scatterHoverId: null,
  scatterSelectedId: null,
  scatterFrame: null,
  scatterTooltipEl: null,
  scatterFocusTopNear: false,
  persistTimer: null,
  serverMode: true,
  weightPreviewData: null,
  analytics: null,
  analyticsKey: '',
  analyticsTimer: null,
  evaluationJobs: [],
  evaluations: [],
  aiSelectedStartupId: null,
  aiBusy: false,
  aiStatusText: '',
  newDraftMeta: { ...NEW_DRAFT_DEFAULTS },
  newDraftPersistTimer: null,
  newStartupDrafts: [],
};

function uid() {
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

function clone(x) {
  return structuredClone(x);
}

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v, d = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Math.abs(v % 1) < 1e-9 ? v.toFixed(0) : v.toFixed(d);
}

function displayColumn(column) {
  if (!/^[A-Z]$/.test(column)) return column;
  if (column === 'A') return 'A';
  return String.fromCharCode(column.charCodeAt(0) - 1);
}

function getMetrics() {
  return state.model.weights;
}

function getRubrics() {
  return state.model.metricRubrics;
}

function getNewStartupMetrics() {
  return getMetrics().slice(0, 8);
}

function newStartupPrompt(metric, index) {
  const prompts = [
    'Who are the founders, what have they built before, and what evidence shows execution strength or weakness?',
    'What is the product today, what problem does it solve, and what proof shows user pull or product clarity?',
    'What commercial evidence exists today: revenue, pilots, conversion, retention, or repeat demand?',
    'How does the business model make money, and what evidence supports monetization quality or margin durability?',
    'Why can this opportunity scale, and what evidence supports market size, expansion, or global reach?',
    'Who are the key competitors, and what evidence shows defensibility, differentiation, or risk?',
    'What do the financials say about burn, runway, discipline, and current operating health?',
    'What credible exit paths exist, and what comparable outcomes or buyer logic support them?',
  ];
  return prompts[index] || `What evidence supports the score for ${metric.label}?`;
}

function setDraftWeightsFromModel() {
  state.draftWeights = scoringCore.createWeightsMap(getMetrics());
}

function applyMetricNameOverrides(model) {
  const byColumn = new Map();
  model.weights.forEach((m, idx) => {
    const nextName = METRIC_NAME_LIST[idx % METRIC_NAME_LIST.length];
    m.label = nextName;
    byColumn.set(m.column, nextName);
  });
  model.metricRubrics.forEach((r, idx) => {
    r.label = byColumn.get(r.column) || METRIC_NAME_LIST[idx % METRIC_NAME_LIST.length];
  });
}

function computeScores(candidate) {
  return scoringCore.computeCandidate(candidate, getMetrics());
}

function recomputeAll() {
  state.candidates = scoringCore.computePortfolio(state.candidates, getMetrics());
}

function quadrantOf(c) {
  const nfTop = c.computed.nonFinancial >= Number(state.thresholds.nf || 0);
  const fTop = c.computed.financial >= Number(state.thresholds.f || 0);
  if (nfTop && fTop) return 'top-right';
  if (!nfTop && fTop) return 'top-left';
  if (nfTop && !fTop) return 'bottom-right';
  return 'bottom-left';
}

function visibleCandidates() {
  let rows = [...state.candidates];
  const q = state.quadrant;
  const s = state.search.trim().toLowerCase();
  if (s) rows = rows.filter((c) => c.name.toLowerCase().includes(s));
  if (q !== 'all') rows = rows.filter((c) => quadrantOf(c) === q);
  rows = rows.filter((c) => passesSavedView(c));
  rows.sort((a, b) => {
    if (state.sort === 'name-asc') return a.name.localeCompare(b.name);
    if (state.sort === 'name-desc') return b.name.localeCompare(a.name);
    if (state.sort === 'total-asc') return a.computed.total - b.computed.total;
    return b.computed.total - a.computed.total;
  });
  return rows;
}

function visibleTableMetrics() {
  return getNewStartupMetrics();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function maxTotals() {
  return scoringCore.maxPossibleTotal(getMetrics(), 5);
}

function pointQuality(candidate) {
  return scoringCore.pointQuality(candidate, getMetrics());
}

function topCandidateExcluding(excludeId = null) {
  const ranked = [...state.candidates]
    .filter((candidate) => candidate.id !== excludeId)
    .sort((a, b) => b.computed.total - a.computed.total || a.name.localeCompare(b.name));
  return ranked[0] || null;
}

function topMetricContributors(candidate, limit = 3) {
  return visibleTableMetrics()
    .map((metric) => {
      const score = scoringCore.resolveMetricScore(candidate, metric.column) ?? 0;
      const weight = Number(metric.weight) || 0;
      return {
        column: metric.column,
        label: metric.label,
        score,
        weight,
        contribution: score * weight,
      };
    })
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit);
}

function fastestImprovementGaps(candidate, limit = 3) {
  return visibleTableMetrics()
    .map((metric) => {
      const score = scoringCore.resolveMetricScore(candidate, metric.column) ?? 0;
      const weight = Number(metric.weight) || 0;
      return {
        column: metric.column,
        label: metric.label,
        score,
        weight,
        gap: Math.max(0, 5 - score) * weight,
      };
    })
    .filter((metric) => metric.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit);
}

function noteCoverageSummary(candidate) {
  const metrics = visibleTableMetrics();
  const filled = metrics.filter((metric) => String(candidate.notes?.[metric.column] || '').trim()).length;
  return { filled, total: metrics.length };
}

function latestEvaluationFor(startupId) {
  return state.evaluations.find((evaluation) => evaluation.startupId === startupId) || null;
}

function decisionBucket(candidate) {
  const quadrant = quadrantOf(candidate);
  if (quadrant === 'top-right') return 'invest';
  if (quadrant === 'top-left') return 'watch-financial';
  if (quadrant === 'bottom-right') return 'watch-non-financial';
  return 'pass';
}

function decisionBucketLabel(bucket) {
  if (bucket === 'invest') return 'Invest';
  if (bucket === 'watch-financial') return 'Watch: Financial';
  if (bucket === 'watch-non-financial') return 'Watch: Non-Financial';
  return 'Pass';
}

function nearThresholdDistance(candidate) {
  const nfGap = Math.abs((candidate.computed?.nonFinancial || 0) - Number(state.thresholds.nf || 0));
  const fGap = Math.abs((candidate.computed?.financial || 0) - Number(state.thresholds.f || 0));
  return Math.min(nfGap, fGap);
}

function disagreementSummary(candidate, limit = 3) {
  const rows = visibleTableMetrics().map((metric) => {
    const sources = [
      num(candidate.scores?.[metric.column]),
      num(candidate.externalScores?.[metric.column]),
      num(candidate.aiScores?.[metric.column]),
    ].filter((value) => value !== null);
    const spread = sources.length >= 2 ? Math.max(...sources) - Math.min(...sources) : 0;
    return {
      column: metric.column,
      label: metric.label,
      spread,
      analyst: num(candidate.scores?.[metric.column]),
      external: num(candidate.externalScores?.[metric.column]),
      ai: num(candidate.aiScores?.[metric.column]),
    };
  }).filter((row) => row.spread > 0);

  const avgSpread = rows.length
    ? rows.reduce((sum, row) => sum + row.spread, 0) / rows.length
    : 0;

  return {
    avgSpread,
    metrics: rows.sort((a, b) => b.spread - a.spread).slice(0, limit),
  };
}

function evaluationSignalSummary(candidate) {
  const evaluation = latestEvaluationFor(candidate.id);
  const analysis = evaluation?.summary?.analysis || null;
  const disagreements = disagreementSummary(candidate, 3);
  return {
    confidence: analysis?.confidence ?? null,
    summary: analysis?.overallSummary || 'No AI evaluation summary yet.',
    strengths: Array.isArray(analysis?.keyStrengths) ? analysis.keyStrengths.slice(0, 3) : [],
    risks: Array.isArray(analysis?.keyRisks) ? analysis.keyRisks.slice(0, 3) : [],
    disagreements,
  };
}

function ensureTableSelection(rows = visibleCandidates()) {
  if (!rows.length) {
    state.selectedTableStartupId = null;
    return null;
  }
  if (!state.selectedTableStartupId || !rows.some((candidate) => candidate.id === state.selectedTableStartupId)) {
    state.selectedTableStartupId = rows[0].id;
  }
  return getCandidateById(state.selectedTableStartupId);
}

function analyticsThresholdKey() {
  return `${Number(state.thresholds.nf ?? 0)}:${Number(state.thresholds.f ?? 0)}`;
}

function parseBucketFloor(label) {
  const match = String(label || '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function bucketIndexForValue(labels, value) {
  const floors = labels.map(parseBucketFloor).filter((floor) => floor !== null);
  if (!floors.length) return 0;
  let index = 0;
  for (let i = 0; i < floors.length; i += 1) {
    if (value >= floors[i]) index = i;
  }
  return index;
}

function analyticsQuadrantOf(candidate, thresholds) {
  const nfTop = candidate.computed.nonFinancial >= Number(thresholds.nf || 0);
  const fTop = candidate.computed.financial >= Number(thresholds.f || 0);
  if (nfTop && fTop) return 'invest';
  if (!nfTop && fTop) return 'watchNonFinancial';
  if (nfTop && !fTop) return 'watchFinancial';
  return 'pass';
}

function buildLocalAnalyticsData() {
  const candidates = [...state.candidates];
  if (!candidates.length) {
    return {
      generatedAt: new Date().toISOString(),
      counts: { candidates: 0, aboveTarget: 0, abovePartnerCutoff: 0 },
      thresholds: { nf: 0, f: 0, totalTarget: 0, partnerCutoff: 0 },
      summary: { averageTotal: 0, medianTotal: 0, averageNonFinancial: 0, averageFinancial: 0, top3Share: 0 },
      quadrants: { invest: 0, watchFinancial: 0, watchNonFinancial: 0, pass: 0 },
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
  const maxTotal = maxTotals();
  const thresholds = {
    nf: Number(state.thresholds.nf ?? Math.round(scoringCore.average(nfValues))),
    f: Number(state.thresholds.f ?? Math.round(scoringCore.average(fValues))),
    totalTarget: Math.round(maxTotal * 0.7),
    partnerCutoff: Math.round(maxTotal * 0.82),
  };

  const quadrants = { invest: 0, watchFinancial: 0, watchNonFinancial: 0, pass: 0 };
  candidates.forEach((candidate) => {
    quadrants[analyticsQuadrantOf(candidate, thresholds)] += 1;
  });

  const bins = 8;
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const step = Math.max(1, (max - min) / bins);
  const counts = Array.from({ length: bins }, () => 0);
  totals.forEach((value) => {
    const idx = Math.min(bins - 1, Math.floor((value - min) / step));
    counts[idx] += 1;
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

  const top10Total = ranking.reduce((sum, row) => sum + row.total, 0) || 1;
  const top3Share = Math.round((ranking.slice(0, 3).reduce((sum, row) => sum + row.total, 0) / top10Total) * 100);

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
    distribution: {
      labels: counts.map((_, i) => `${Math.round(min + i * step)}+`),
      counts,
    },
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
}

function currentAnalyticsData() {
  return state.serverMode && state.analytics && state.analyticsKey === analyticsThresholdKey()
    ? state.analytics
    : buildLocalAnalyticsData();
}

function getCandidateById(id) {
  return state.candidates.find((c) => c.id === id) || null;
}

function getScatterPointById(id) {
  return state.scatterPoints.find((p) => p.id === id) || null;
}

function canvasPosFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

function findNearestScatterPoint(x, y) {
  let best = null;
  let bestD2 = Infinity;
  for (const p of state.scatterPoints) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return bestD2 <= 14 * 14 ? best : null;
}

function ensureScatterTooltip() {
  if (state.scatterTooltipEl) return state.scatterTooltipEl;
  const host = els.scatterCanvas.closest('.chart-card') || els.scatterCanvas.parentElement;
  if (!host) return null;
  if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const tip = document.createElement('div');
  tip.hidden = true;
  tip.style.position = 'absolute';
  tip.style.pointerEvents = 'none';
  tip.style.zIndex = '5';
  tip.style.maxWidth = '320px';
  tip.style.padding = '10px 12px';
  tip.style.border = '1px solid #d8e0ec';
  tip.style.borderRadius = '12px';
  tip.style.background = 'rgba(255,255,255,0.96)';
  tip.style.boxShadow = '0 10px 28px rgba(15, 23, 42, 0.14)';
  tip.style.color = '#0f172a';
  tip.style.font = '13px "Helvetica Neue", Helvetica, Arial, sans-serif';
  host.appendChild(tip);
  state.scatterTooltipEl = tip;
  return tip;
}

function hideScatterTooltip() {
  if (state.scatterTooltipEl) state.scatterTooltipEl.hidden = true;
}

function showScatterTooltip(point, clientX, clientY) {
  const tip = ensureScatterTooltip();
  if (!tip) return;
  const host = els.scatterCanvas.closest('.chart-card') || els.scatterCanvas.parentElement;
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const c = point.candidate;
  tip.innerHTML = [
    `<div style="font-weight:800;margin-bottom:4px">${escapeHtml(c.name)}</div>`,
    `<div>NF: <strong>${escapeHtml(fmt(c.computed.nonFinancial))}</strong> · F: <strong>${escapeHtml(fmt(c.computed.financial))}</strong></div>`,
    `<div>Total: <strong>${escapeHtml(fmt(c.computed.total))}</strong> · Quadrant: <strong>${escapeHtml(point.quadrant)}</strong></div>`,
  ].join('');
  tip.hidden = false;

  const pad = 14;
  const desiredLeft = clientX - rect.left + 12;
  const desiredTop = clientY - rect.top - tip.offsetHeight - 12;
  const maxLeft = host.clientWidth - tip.offsetWidth - pad;
  const minLeft = pad;
  let left = Math.max(minLeft, Math.min(maxLeft, desiredLeft));
  let top = desiredTop;
  if (top < pad) top = clientY - rect.top + 14;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function prepareCanvas(canvas) {
  const ratio = Math.min(3, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(220, Math.round(rect.height));
  const targetW = Math.round(width * ratio);
  const targetH = Math.round(height * ratio);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function serialize() {
  return {
    ...serializeServerSnapshot(),
    ui: serializeUi(),
    newStartupDrafts: clone(state.newStartupDrafts || []),
    newStartupDraft: serializeNewStartupDraft(),
  };
}

function serializeServerSnapshot() {
  return {
    model: clone(state.model),
    candidates: state.candidates.map((c) => ({
      id: c.id,
      sourceIndex: c.sourceIndex,
      name: c.name,
      normalizedName: c.normalizedName,
      scores: clone(c.scores),
      externalScores: clone(c.externalScores || {}),
      aiScores: clone(c.aiScores || {}),
      aiRationales: clone(c.aiRationales || {}),
      notes: clone(c.notes),
      computedFromExcel: clone(c.computedFromExcel),
      isNew: !!c.isNew,
      tags: clone(candidateTags(c)),
      stage: candidateStage(c),
      lastAiEvaluationId: c.lastAiEvaluationId || null,
    })),
  };
}

function serializeUi() {
  return {
    activePane: state.activePane,
    scatterControlsOpen: state.scatterControlsOpen,
    thresholds: clone(state.thresholds),
    labelMode: state.labelMode,
    search: state.search,
    sort: state.sort,
    quadrant: state.quadrant,
    savedView: state.savedView,
    compareA: state.compareA,
    compareB: state.compareB,
    compareMode: state.compareMode,
    scatterSelectedId: state.scatterSelectedId,
    scatterFocusTopNear: state.scatterFocusTopNear,
    weightPreset: state.weightPreset,
    aiSelectedStartupId: state.aiSelectedStartupId,
  };
}

function serializeNewStartupDraft() {
  const draft = state.newDraft;
  const meta = state.newDraftMeta || NEW_DRAFT_DEFAULTS;
  const hasName = Boolean((meta.name || '').trim());
  const hasClone = Boolean(meta.clone);
  const hasMeaningfulDraft = draft && getNewStartupMetrics().some((metric) => {
    const score = num(draft.scores?.[metric.column]);
    const external = num(draft.externalScores?.[metric.column]);
    const note = String(draft.notes?.[metric.column] || '').trim();
    return score !== null || external !== null || note;
  });
  if (!hasName && !hasClone && !hasMeaningfulDraft) return null;
  return {
    meta: {
      draftId: meta.draftId || '',
      name: meta.name || '',
      template: meta.template || NEW_DRAFT_DEFAULTS.template,
      clone: meta.clone || '',
      notesMode: meta.notesMode || NEW_DRAFT_DEFAULTS.notesMode,
      savedAt: meta.savedAt || null,
    },
    draft: draft ? clone(draft) : emptyDraft(),
  };
}

function saveUi() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ui: serializeUi(),
    newStartupDrafts: clone(state.newStartupDrafts || []),
    newStartupDraft: serializeNewStartupDraft(),
  }));
}

function newStartupDraftKey(draftId) {
  return `${NEW_STARTUP_DRAFT_PREFIX}${draftId}`;
}

function ensureNewDraftId() {
  if (state.newDraftMeta.draftId) return state.newDraftMeta.draftId;
  state.newDraftMeta.draftId = uid();
  return state.newDraftMeta.draftId;
}

function draftSavedAtValue(draft) {
  const raw = draft?.meta?.savedAt;
  if (!raw) return 0;
  const timeValue = new Date(raw).getTime();
  return Number.isFinite(timeValue) ? timeValue : 0;
}

function pickNewestDraft(primaryDraft, secondaryDraft) {
  if (!primaryDraft) return secondaryDraft || null;
  if (!secondaryDraft) return primaryDraft;
  return draftSavedAtValue(secondaryDraft) > draftSavedAtValue(primaryDraft) ? secondaryDraft : primaryDraft;
}

function normalizeDraftLibraryEntry(draft, fallbackKey = '') {
  if (!draft) return null;
  const draftId = draft?.meta?.draftId || (fallbackKey ? fallbackKey.replace(NEW_STARTUP_DRAFT_PREFIX, '') : '');
  return {
    workflowKey: draft.workflowKey || (draftId ? newStartupDraftKey(draftId) : fallbackKey || ''),
    meta: {
      ...NEW_DRAFT_DEFAULTS,
      ...(draft.meta || {}),
      draftId,
    },
    draft: draft.draft ? clone(draft.draft) : emptyDraft(),
  };
}

function syncDraftLibraryWithCurrent() {
  const current = normalizeDraftLibraryEntry(serializeNewStartupDraft());
  const existing = Array.isArray(state.newStartupDrafts) ? state.newStartupDrafts : [];
  if (!current?.meta?.draftId) {
    state.newStartupDrafts = existing
      .filter((draft) => draft?.meta?.draftId)
      .sort((a, b) => draftSavedAtValue(b) - draftSavedAtValue(a));
    return;
  }
  const filtered = existing.filter((draft) => draft?.meta?.draftId !== current.meta.draftId);
  state.newStartupDrafts = [current, ...filtered]
    .sort((a, b) => draftSavedAtValue(b) - draftSavedAtValue(a));
}

async function persistServerSnapshot() {
  if (!state.serverMode) return;
  try {
    const res = await fetch(SNAPSHOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeServerSnapshot()),
    });
    if (!res.ok) throw new Error(`Persist failed: ${res.status}`);
  } catch (error) {
    console.error(error);
  }
}

function save() {
  saveUi();
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${url} failed: ${res.status}`);
  return res.json();
}

async function refreshAnalytics(options = {}) {
  const { render = true } = options;
  if (!state.serverMode) {
    state.analytics = null;
    state.analyticsKey = analyticsThresholdKey();
    if (render) renderAnalysisPanels();
    return null;
  }
  const key = analyticsThresholdKey();
  try {
    state.analytics = await apiJson(`${ANALYTICS_PORTFOLIO_URL}?nf=${encodeURIComponent(state.thresholds.nf ?? 0)}&f=${encodeURIComponent(state.thresholds.f ?? 0)}`);
    state.analyticsKey = key;
  } catch (error) {
    console.error(error);
    state.analytics = null;
    state.analyticsKey = '';
  }
  if (render) renderAnalysisPanels();
  return state.analytics;
}

function scheduleAnalyticsRefresh() {
  clearTimeout(state.analyticsTimer);
  state.analyticsTimer = window.setTimeout(() => {
    refreshAnalytics().catch(console.error);
  }, 220);
}

async function refreshEvaluationWorkflow(options = {}) {
  const { render = true } = options;
  if (!state.serverMode) {
    state.evaluationJobs = [];
    state.evaluations = [];
    if (render) renderAiWorkflow();
    return;
  }
  try {
    const [jobs, evaluations] = await Promise.all([
      apiJson(EVALUATION_JOBS_URL),
      apiJson(EVALUATIONS_URL),
    ]);
    state.evaluationJobs = Array.isArray(jobs) ? jobs : [];
    state.evaluations = Array.isArray(evaluations) ? evaluations : [];
  } catch (error) {
    console.error(error);
    state.evaluationJobs = [];
    state.evaluations = [];
  }
  if (render) renderAiWorkflow();
}

async function refreshRemoteDerivedData(options = {}) {
  const { analytics = true, workflow = true, render = true } = options;
  if (!state.serverMode) {
    if (render) renderAnalysisPanels();
    return;
  }
  await Promise.all([
    analytics ? refreshAnalytics({ render: false }) : Promise.resolve(),
    workflow ? refreshEvaluationWorkflow({ render: false }) : Promise.resolve(),
  ]);
  if (render) renderAnalysisPanels();
}

async function updateStartupRemote(id, patch) {
  return apiJson(`${STARTUPS_URL}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

async function fetchBootstrapSnapshot() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
    state.serverMode = true;
    return await res.json();
  } catch (error) {
    const fallback = await fetch(FALLBACK_DATA_URL);
    if (!fallback.ok) throw error;
    state.serverMode = false;
    return await fallback.json();
  }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hydrate(snapshot) {
  state.model = snapshot.model;
  applyMetricNameOverrides(state.model);
  state.candidates = snapshot.candidates.map((c) => ({
    ...c,
    externalScores: c.externalScores || {},
    aiScores: c.aiScores || {},
    aiRationales: c.aiRationales || {},
    lastAiEvaluationId: c.lastAiEvaluationId || null,
    computed: { nonFinancial: 0, financial: 0, total: 0 },
  }));

  const ui = snapshot.ui || {};
  state.activePane = ui.activePane || 'analysis';
  state.scatterControlsOpen = !!ui.scatterControlsOpen;
  state.thresholds = ui.thresholds || { nf: null, f: null };
  state.labelMode = ui.labelMode || 'smart';
  state.search = ui.search || '';
  state.sort = ui.sort || 'total-desc';
  state.quadrant = ui.quadrant || 'all';
  state.savedView = ui.savedView || 'all';
  state.compareA = ui.compareA || state.candidates[0]?.id || null;
  state.compareB = ui.compareB || state.candidates.find((c) => c.id !== state.compareA)?.id || state.compareA;
  state.compareMode = ui.compareMode || 'raw';
  state.scatterSelectedId = ui.scatterSelectedId || null;
  state.scatterFocusTopNear = Boolean(ui.scatterFocusTopNear);
  state.weightPreset = ui.weightPreset || 'balanced';
  state.aiSelectedStartupId = ui.aiSelectedStartupId || state.scatterSelectedId || state.compareA;
  state.selectedRows = [];
  state.selectedTableStartupId = null;
  state.weightPreviewData = null;
  state.analytics = null;
  state.analyticsKey = '';
  state.evaluationJobs = [];
  state.evaluations = [];
  state.aiStatusText = '';
  state.newStartupDrafts = Array.isArray(snapshot.newStartupDrafts)
    ? snapshot.newStartupDrafts.map((draft) => normalizeDraftLibraryEntry(draft)).filter(Boolean)
    : [];
  state.newDraftMeta = {
    ...NEW_DRAFT_DEFAULTS,
    ...(snapshot.newStartupDraft?.meta || {}),
  };
  state.newDraft = snapshot.newStartupDraft?.draft ? clone(snapshot.newStartupDraft.draft) : null;
  syncDraftLibraryWithCurrent();

  recomputeAll();
  setDraftWeightsFromModel();
  if (state.thresholds.nf === null) state.thresholds.nf = Math.round(scoringCore.average(state.candidates.map((c) => c.computed.nonFinancial)));
  if (state.thresholds.f === null) state.thresholds.f = Math.round(scoringCore.average(state.candidates.map((c) => c.computed.financial)));
}

function freshSnapshot() {
  return {
    model: clone(state.original.model),
    candidates: state.original.candidates.map((c, i) => ({
      id: uid(),
      sourceIndex: i,
      name: c.name,
      normalizedName: c.normalizedName,
      scores: clone(c.scores),
      externalScores: clone(c.externalScores || {}),
      aiScores: clone(c.aiScores || {}),
      aiRationales: clone(c.aiRationales || {}),
      notes: clone(c.notes || {}),
      computedFromExcel: clone(c.computedFromExcel || null),
      isNew: false,
      tags: [],
      stage: 'sourcing',
      lastAiEvaluationId: c.lastAiEvaluationId || null,
    })),
    ui: {},
    newStartupDraft: null,
  };
}

function syncNewDraftMetaFromInputs() {
  state.newDraftMeta = {
    ...state.newDraftMeta,
    name: els.newName?.value || '',
    template: els.newTemplate?.value || NEW_DRAFT_DEFAULTS.template,
    clone: els.newClone?.value || '',
    notesMode: els.newNotesMode?.value || NEW_DRAFT_DEFAULTS.notesMode,
  };
}

function resetNewDraftMeta() {
  state.newDraftMeta = { ...NEW_DRAFT_DEFAULTS };
}

async function persistNewStartupDraftRemote() {
  const draftId = ensureNewDraftId();
  const payload = serializeNewStartupDraft();
  if (!state.serverMode) return payload;
  if (!payload) {
    await apiJson(`${DRAFTS_URL}/${encodeURIComponent(newStartupDraftKey(draftId))}`, { method: 'DELETE' });
    return null;
  }
  payload.meta.draftId = draftId;
  const result = await apiJson(`${DRAFTS_URL}/${encodeURIComponent(newStartupDraftKey(draftId))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return result?.draft || payload;
}

async function clearPersistedNewStartupDraft(message = 'Draft cleared.', draftIdOverride = '') {
  const draftId = draftIdOverride || state.newDraftMeta.draftId || '';
  saveUi();
  renderNewDraftStatus(message);
  state.newStartupDrafts = state.newStartupDrafts.filter((draft) => draft?.meta?.draftId !== draftId);
  renderNewDraftPicker();
  if (!state.serverMode) return;
  if (!draftId) return;
  try {
    await apiJson(`${DRAFTS_URL}/${encodeURIComponent(newStartupDraftKey(draftId))}`, { method: 'DELETE' });
  } catch (error) {
    console.error(error);
    renderNewDraftStatus('Draft cleared locally. Server sync failed.');
  }
}

async function markNewDraftSaved(message = 'Draft saved locally.', options = {}) {
  const { syncInputs = true } = options;
  if (syncInputs) syncNewDraftMetaFromInputs();
  const pendingDraft = serializeNewStartupDraft();
  if (!pendingDraft) {
    await clearPersistedNewStartupDraft('Draft not saved yet.');
    return;
  }
  ensureNewDraftId();
  state.newDraftMeta.savedAt = Date.now();
  saveUi();
  renderNewDraftStatus(state.serverMode ? 'Saving draft to server…' : message);
  if (!state.serverMode) {
    renderNewDraftStatus(message);
    return;
  }
  try {
    const savedDraft = await persistNewStartupDraftRemote();
    if (savedDraft?.meta) {
      state.newDraftMeta = {
        ...state.newDraftMeta,
        ...savedDraft.meta,
      };
      if (savedDraft.draft) state.newDraft = clone(savedDraft.draft);
    }
    syncDraftLibraryWithCurrent();
    saveUi();
    renderNewDraftStatus('Draft saved to server.');
  } catch (error) {
    console.error(error);
    renderNewDraftStatus('Draft saved locally. Server sync failed.');
  }
}

function scheduleNewDraftPersist() {
  clearTimeout(state.newDraftPersistTimer);
  state.newDraftPersistTimer = window.setTimeout(() => {
    markNewDraftSaved(state.serverMode ? 'Draft autosaved to server.' : 'Draft autosaved locally.').catch(console.error);
  }, 250);
}

function renderNewDraftStatus(message = '') {
  if (!els.newDraftStatus) return;
  const savedAt = state.newDraftMeta?.savedAt;
  const timeText = savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString()}` : 'Draft not saved yet.';
  els.newDraftStatus.textContent = message ? `${message} ${timeText}` : timeText;
}

async function refreshNewStartupDraftLibrary() {
  if (!state.serverMode) {
    syncDraftLibraryWithCurrent();
    return state.newStartupDrafts;
  }
  try {
    const drafts = await apiJson(`${DRAFTS_URL}?prefix=${encodeURIComponent(NEW_STARTUP_DRAFT_PREFIX)}`);
    state.newStartupDrafts = Array.isArray(drafts)
      ? drafts.map((draft) => normalizeDraftLibraryEntry(draft)).filter(Boolean)
      : [];
    syncDraftLibraryWithCurrent();
  } catch (error) {
    console.error(error);
  }
  return state.newStartupDrafts;
}

function activateNewStartupDraft(draft) {
  const normalized = normalizeDraftLibraryEntry(draft, draft?.workflowKey || '');
  if (!normalized) return;
  state.newDraftMeta = {
    ...NEW_DRAFT_DEFAULTS,
    ...(normalized.meta || {}),
  };
  state.newDraft = normalized.draft ? clone(normalized.draft) : emptyDraft();
  syncDraftLibraryWithCurrent();
}

function startFreshNewDraft() {
  state.newDraft = null;
  resetNewDraftMeta();
  buildDraftFromSelections();
  syncDraftLibraryWithCurrent();
}

function renderNewDraftPicker() {
  if (!els.newDraftPicker) return;
  const drafts = [...(state.newStartupDrafts || [])].sort((a, b) => draftSavedAtValue(b) - draftSavedAtValue(a));
  els.newDraftPicker.innerHTML = '';
  if (!drafts.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No saved drafts';
    els.newDraftPicker.appendChild(option);
    els.loadDraftBtn.disabled = true;
    els.deleteDraftBtn.disabled = !state.newDraftMeta.draftId;
    return;
  }
  drafts.forEach((draft, index) => {
    const option = document.createElement('option');
    option.value = draft.meta.draftId;
    const name = (draft.meta.name || '').trim() || `Untitled draft ${index + 1}`;
    const savedAt = draftSavedAtValue(draft);
    const suffix = savedAt ? ` · ${new Date(savedAt).toLocaleString()}` : '';
    option.textContent = `${name}${suffix}`;
    option.selected = draft.meta.draftId === state.newDraftMeta.draftId;
    els.newDraftPicker.appendChild(option);
  });
  if (!state.newDraftMeta.draftId && els.newDraftPicker.options.length) {
    els.newDraftPicker.selectedIndex = 0;
  }
  els.loadDraftBtn.disabled = !els.newDraftPicker.value;
  els.deleteDraftBtn.disabled = !(state.newDraftMeta.draftId || els.newDraftPicker.value);
}

function setPane(pane) {
  state.activePane = pane;
  els.panes.forEach((p) => { p.hidden = p.dataset.pane !== pane; });
  els.navBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.pane === pane));
  if (pane !== 'analysis') {
    state.scatterHoverId = null;
    hideScatterTooltip();
  }
}

function renderScatter() {
  const canvas = els.scatterCanvas;
  const { ctx, width: W, height: H } = prepareCanvas(canvas);
  const baseRows = visibleCandidates();
  const pad = { l: 64, r: 24, t: 24, b: 64 };
  const plot = { x: pad.l, y: pad.t, w: W - pad.l - pad.r, h: H - pad.t - pad.b };

  const maxNF = Math.max(1, ...state.candidates.map((c) => c.computed.nonFinancial), Number(state.thresholds.nf || 0));
  const maxF = Math.max(1, ...state.candidates.map((c) => c.computed.financial), Number(state.thresholds.f || 0));
  const xMax = Math.ceil(maxNF / 10) * 10;
  const yMax = Math.ceil(maxF / 10) * 10;
  const nearBandNF = Math.max(8, xMax * 0.08);
  const nearBandF = Math.max(5, yMax * 0.08);
  const rows = state.scatterFocusTopNear
    ? baseRows.filter((c) => {
        const q = quadrantOf(c);
        const nearNF = Math.abs(c.computed.nonFinancial - Number(state.thresholds.nf || 0)) <= nearBandNF;
        const nearF = Math.abs(c.computed.financial - Number(state.thresholds.f || 0)) <= nearBandF;
        return q === 'top-right' || nearNF || nearF;
      })
    : baseRows;
  state.scatterFrame = { plot, xMax, yMax };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(15,23,42,0.12)';
  for (let i = 0; i <= 5; i++) {
    const x = plot.x + (plot.w * i / 5);
    const y = plot.y + (plot.h * i / 5);
    ctx.beginPath(); ctx.moveTo(x, plot.y); ctx.lineTo(x, plot.y + plot.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke();
  }

  ctx.fillStyle = '#5b6b86';
  ctx.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Non-Financial Score', plot.x + plot.w / 2, H - 10);
  ctx.save();
  ctx.translate(16, plot.y + plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Financial Score', 0, 0);
  ctx.restore();

  const toX = (v) => plot.x + (v / xMax) * plot.w;
  const toY = (v) => plot.y + plot.h - (v / yMax) * plot.h;

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#2f6bff';
  ctx.beginPath(); ctx.moveTo(toX(state.thresholds.nf), plot.y); ctx.lineTo(toX(state.thresholds.nf), plot.y + plot.h); ctx.stroke();
  ctx.strokeStyle = '#00a3a3';
  ctx.beginPath(); ctx.moveTo(plot.x, toY(state.thresholds.f)); ctx.lineTo(plot.x + plot.w, toY(state.thresholds.f)); ctx.stroke();
  ctx.setLineDash([]);

  const zoneLabel = (text, x, y, tone) => {
    ctx.fillStyle = tone;
    ctx.font = '700 12px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  };
  const cxLeft = (plot.x + toX(state.thresholds.nf)) / 2;
  const cxRight = (toX(state.thresholds.nf) + plot.x + plot.w) / 2;
  const cyTop = (plot.y + toY(state.thresholds.f)) / 2;
  const cyBottom = (toY(state.thresholds.f) + plot.y + plot.h) / 2;
  zoneLabel('WATCH', cxLeft, cyTop, 'rgba(47,107,255,0.55)');
  zoneLabel('INVEST', cxRight, cyTop, 'rgba(0,163,163,0.62)');
  zoneLabel('WATCH', cxRight, cyBottom, 'rgba(19,185,129,0.55)');
  zoneLabel('PASS', cxLeft, cyBottom, 'rgba(148,163,184,0.62)');

  const color = (q) => q === 'top-right' ? '#00a3a3' : q === 'top-left' ? '#2f6bff' : q === 'bottom-right' ? '#13b981' : '#94a3b8';

  state.scatterPoints = rows.map((c) => {
    const q = quadrantOf(c);
    return {
      id: c.id,
      candidate: c,
      x: toX(c.computed.nonFinancial),
      y: toY(c.computed.financial),
      quadrant: q,
      quality: pointQuality(c),
    };
  });

  if (state.scatterHoverId && !getScatterPointById(state.scatterHoverId)) state.scatterHoverId = null;
  if (state.scatterSelectedId && !getScatterPointById(state.scatterSelectedId)) state.scatterSelectedId = null;

  const drawCircle = (p) => {
    const conf = p.quality.confidence;
    const cov = p.quality.coverage;
    const confColor = conf >= 0.75 ? '#0f766e' : conf >= 0.5 ? '#d97706' : '#b91c1c';
    const baseR = 5.5 + cov * 2.6;
    if (p.id === state.scatterSelectedId) {
      ctx.fillStyle = 'rgba(47,107,255,0.15)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseR + 5.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color(p.quadrant);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.id === state.scatterHoverId ? baseR + 1.8 : baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = confColor;
    ctx.lineWidth = 1 + conf * 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR + 0.4, 0, Math.PI * 2);
    ctx.stroke();
    if (p.id === state.scatterHoverId || p.id === state.scatterSelectedId) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.id === state.scatterHoverId ? baseR + 2.8 : baseR + 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  };

  const boxes = [];
  const intersects = (a, b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  const drawLabelForPoint = (p, force = false) => {
    const text = p.candidate.name;
    ctx.font = '11px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const tw = Math.ceil(ctx.measureText(text).width);
    const th = 14;
    const options = [
      { dx: 10, dy: -10, align: 'left' },
      { dx: 10, dy: 14, align: 'left' },
      { dx: -10, dy: -10, align: 'right' },
      { dx: -10, dy: 14, align: 'right' },
      { dx: 0, dy: -16, align: 'center' },
      { dx: 0, dy: 20, align: 'center' },
    ];
    let placed = null;
    for (const opt of options) {
      const x = opt.align === 'left' ? p.x + opt.dx : opt.align === 'right' ? p.x - opt.dx - tw : p.x - tw / 2;
      const y = p.y + opt.dy - th + 2;
      const box = { x: x - 2, y: y - 2, w: tw + 4, h: th + 4 };
      const inBounds = box.x >= plot.x && box.x + box.w <= plot.x + plot.w && box.y >= plot.y && box.y + box.h <= plot.y + plot.h;
      if (!inBounds && !force) continue;
      if (boxes.some((b) => intersects(b, box)) && !force) continue;
      placed = { x, y, align: opt.align, box };
      break;
    }
    if (!placed) {
      if (!force) return;
      placed = { x: p.x + 10, y: p.y - 12, align: 'left', box: { x: p.x + 8, y: p.y - 24, w: tw + 4, h: th + 4 } };
    }
    boxes.push(placed.box);
    ctx.textAlign = placed.align;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(text, placed.x, placed.y + th - 4);
  };

  state.scatterPoints.forEach(drawCircle);

  if (state.labelMode !== 'none') {
    const prioritized = [...state.scatterPoints].sort((a, b) => {
      const pa = (a.id === state.scatterHoverId ? 2 : 0) + (a.id === state.scatterSelectedId ? 1 : 0);
      const pb = (b.id === state.scatterHoverId ? 2 : 0) + (b.id === state.scatterSelectedId ? 1 : 0);
      if (pb !== pa) return pb - pa;
      return b.candidate.computed.total - a.candidate.computed.total;
    });
    const maxLabels = state.labelMode === 'smart' ? 12 : prioritized.length;
    prioritized.slice(0, maxLabels).forEach((p) => drawLabelForPoint(p, state.labelMode === 'all'));
  }

  const counts = { 'top-right': 0, 'top-left': 0, 'bottom-right': 0, 'bottom-left': 0 };
  state.candidates.forEach((c) => { counts[quadrantOf(c)] += 1; });
  const hoverPoint = getScatterPointById(state.scatterHoverId);
  const pinPoint = getScatterPointById(state.scatterSelectedId);
  const hoverText = hoverPoint
    ? ` · Hover: ${hoverPoint.candidate.name} (NF ${fmt(hoverPoint.candidate.computed.nonFinancial)}, F ${fmt(hoverPoint.candidate.computed.financial)}, Total ${fmt(hoverPoint.candidate.computed.total)})`
    : '';
  const pinText = pinPoint && !hoverPoint
    ? ` · Selected: ${pinPoint.candidate.name} (NF ${fmt(pinPoint.candidate.computed.nonFinancial)}, F ${fmt(pinPoint.candidate.computed.financial)}, Total ${fmt(pinPoint.candidate.computed.total)})`
    : '';
  const focusText = state.scatterFocusTopNear ? ' · Focus: top-right + near-threshold' : '';
  els.scatterLegend.textContent = `Top-right ${counts['top-right']} · Top-left ${counts['top-left']} · Bottom-right ${counts['bottom-right']} · Bottom-left ${counts['bottom-left']} · Ring color=confidence, size=coverage${focusText}${hoverText}${pinText}`;
}

function drawBars(canvas, labels, values, color = '#2f6bff', options = {}) {
  const { ctx, width: W, height: H } = prepareCanvas(canvas);
  const pad = { l: 52, r: 18, t: 16, b: 84 };
  const plot = { x: pad.l, y: pad.t, w: W - pad.l - pad.r, h: H - pad.t - pad.b };
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  const maxV = Math.max(1, ...values);
  const lane = plot.w / Math.max(1, labels.length);
  const barWidth = Math.max(14, Math.min(40, lane - 14));
  ctx.strokeStyle = 'rgba(15,23,42,0.1)';
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h * i / 4;
    ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke();
  }

  if (Array.isArray(options.benchmarks)) {
    options.benchmarks.forEach((b) => {
      const y = plot.y + plot.h - (Math.max(0, b.value) / maxV) * plot.h;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = b.color || '#64748b';
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = b.color || '#64748b';
      ctx.font = '10px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(b.label, plot.x + 4, y - 4);
    });
  }

  const fitText = (text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 2 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
    return `${out}…`;
  };

  const wrap = (text, maxWidth, maxLines = 2) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let i = 0;
    for (let lineNo = 0; lineNo < maxLines && i < words.length; lineNo++) {
      let line = words[i++];
      while (i < words.length) {
        const next = `${line} ${words[i]}`;
        if (ctx.measureText(next).width > maxWidth) break;
        line = next;
        i += 1;
      }
      lines.push(line);
    }
    if (i < words.length) lines[maxLines - 1] = fitText(`${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, maxWidth);
    return lines;
  };

  ctx.font = '11px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((lb, i) => {
    const v = values[i] || 0;
    const h = (v / maxV) * plot.h;
    const cx = plot.x + i * lane + lane / 2;
    const x = cx - barWidth / 2;
    const y = plot.y + plot.h - h;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, h);

    const nameLines = wrap(lb, Math.max(40, lane - 8), 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - lane / 2 + 2, H - 44, lane - 4, 36);
    ctx.clip();
    ctx.fillStyle = '#334155';
    nameLines.forEach((line, lineIndex) => {
      ctx.fillText(line, cx, H - 30 + lineIndex * 13);
    });
    ctx.restore();
  });
}

function renderRanking() {
  const analytics = currentAnalyticsData();
  const rows = analytics.ranking.slice(0, 8);
  const vals = rows.map((row) => row.total);
  drawBars(els.rankingCanvas, rows.map((row) => row.name), vals, '#2f6bff', {
    benchmarks: [
      { label: `Median ${fmt(analytics.summary.medianTotal)}`, value: analytics.summary.medianTotal, color: '#64748b' },
      { label: `Target ${fmt(analytics.thresholds.totalTarget)}`, value: analytics.thresholds.totalTarget, color: '#2563eb' },
      { label: `Partner cutoff ${fmt(analytics.thresholds.partnerCutoff)}`, value: analytics.thresholds.partnerCutoff, color: '#059669' },
    ],
  });
  if (els.insightPipelineQuality) {
    els.insightPipelineQuality.textContent = analytics.insights.pipelineQuality;
  }
}

function renderDistribution() {
  const analytics = currentAnalyticsData();
  const labels = analytics.distribution.labels || [];
  const counts = analytics.distribution.counts || [];
  if (!labels.length || !counts.length) {
    drawBars(els.distCanvas, [], [], '#00a3a3');
    if (els.insightRiskDispersion) els.insightRiskDispersion.textContent = analytics.insights.riskDispersion;
    return;
  }
  const medianIndex = bucketIndexForValue(labels, analytics.summary.medianTotal);
  const targetIndex = bucketIndexForValue(labels, analytics.thresholds.totalTarget);
  const cutoffIndex = bucketIndexForValue(labels, analytics.thresholds.partnerCutoff);
  drawBars(els.distCanvas, labels, counts, '#00a3a3', {
    benchmarks: [
      { label: 'Median bucket', value: counts[medianIndex] || 0, color: '#64748b' },
      { label: 'Target bucket', value: counts[targetIndex] || 0, color: '#2563eb' },
      { label: 'Cutoff bucket', value: counts[cutoffIndex] || 0, color: '#059669' },
    ],
  });
  if (els.insightRiskDispersion) {
    els.insightRiskDispersion.textContent = analytics.insights.riskDispersion;
  }
}

function renderQuadrantPieChart() {
  if (!els.quadrantPieCanvas) return;
  const { ctx, width: W, height: H } = prepareCanvas(els.quadrantPieCanvas);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const analytics = currentAnalyticsData();
  const quadrants = ['invest', 'watchNonFinancial', 'watchFinancial', 'pass'];
  const labels = ['Invest', 'Watch: NF', 'Watch: F', 'Pass'];
  const colors = ['#00a3a3', '#2f6bff', '#13b981', '#94a3b8'];
  const values = quadrants.map((q) => analytics.quadrants[q] || 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;

  const cx = Math.round(W * 0.3);
  const cy = Math.round(H * 0.5);
  const radius = Math.min(H * 0.32, W * 0.2);
  const inner = radius * 0.58;
  let angle = -Math.PI / 2;

  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = colors[i];
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fill();
  });

  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = '700 14px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillText('Quadrants', cx, cy - 6);
  ctx.font = '700 22px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillText(String(state.candidates.length), cx, cy + 20);

  const lx = Math.round(W * 0.56);
  const ly = Math.round(H * 0.22);
  labels.forEach((name, i) => {
    const y = ly + i * 42;
    const val = values[i];
    const pct = Math.round((val / total) * 100);
    ctx.fillStyle = colors[i];
    ctx.fillRect(lx, y - 10, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(`${name}: ${val} (${pct}%)`, lx + 18, y);
  });

  if (els.insightDealflowBalance) {
    els.insightDealflowBalance.textContent = analytics.insights.dealflowBalance;
  }
}

function renderRankingContributionChart() {
  if (!els.rankingContributionCanvas) return;
  const { ctx, width: W, height: H } = prepareCanvas(els.rankingContributionCanvas);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const analytics = currentAnalyticsData();
  const rows = analytics.ranking.slice(0, 10);
  if (!rows.length) return;
  const total = rows.reduce((s, r) => s + r.total, 0) || 1;
  let cumulative = 0;
  const cumPct = rows.map((r) => {
    cumulative += r.total;
    return (cumulative / total) * 100;
  });

  const pad = { l: 48, r: 22, t: 24, b: 72 };
  const plot = { x: pad.l, y: pad.t, w: W - pad.l - pad.r, h: H - pad.t - pad.b };
  const lane = plot.w / rows.length;
  const barW = Math.max(12, Math.min(34, lane - 10));
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  ctx.strokeStyle = 'rgba(15,23,42,0.1)';
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h * i / 4;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
  }

  rows.forEach((r, i) => {
    const cx = plot.x + lane * i + lane / 2;
    const h = (r.total / maxTotal) * plot.h;
    const x = cx - barW / 2;
    const y = plot.y + plot.h - h;
    ctx.fillStyle = '#2f6bff';
    ctx.fillRect(x, y, barW, h);
  });

  ctx.strokeStyle = '#00a3a3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  rows.forEach((_, i) => {
    const cx = plot.x + lane * i + lane / 2;
    const y = plot.y + plot.h - (cumPct[i] / 100) * plot.h;
    if (i === 0) ctx.moveTo(cx, y);
    else ctx.lineTo(cx, y);
  });
  ctx.stroke();
  ctx.lineWidth = 1;

  const fit = (text, maxW) => {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 2 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s}…`;
  };

  ctx.textAlign = 'center';
  ctx.font = '10px "Helvetica Neue", Helvetica, Arial, sans-serif';
  rows.forEach((r, i) => {
    const cx = plot.x + lane * i + lane / 2;
    const label = fit(r.name, Math.max(28, lane - 6));
    ctx.fillStyle = '#334155';
    ctx.fillText(label, cx, H - 28);
    ctx.fillStyle = '#00a3a3';
    ctx.fillText(`${Math.round(cumPct[i])}%`, cx, H - 12);
  });

  if (els.insightConvictionConcentration) {
    els.insightConvictionConcentration.textContent = analytics.insights.convictionConcentration;
  }
}

function renderOpportunityChart() {
  if (!els.opportunityCanvas) return;
  const analytics = currentAnalyticsData();
  const rows = analytics.opportunities || [];
  drawBars(
    els.opportunityCanvas,
    rows.map((r) => r.name),
    rows.map((r) => r.gap),
    '#7c3aed',
    {
      benchmarks: [
        { label: `Median gap ${fmt(scoringCore.median(rows.map((r) => r.gap)))}`, value: scoringCore.median(rows.map((r) => r.gap)), color: '#64748b' },
      ],
    },
  );
  if (els.insightOpportunity) {
    els.insightOpportunity.textContent = analytics.insights.opportunity;
  }
}

function renderAiWorkflow() {
  if (!els.aiStartupSelect) return;

  const sorted = [...state.candidates].sort((a, b) => a.name.localeCompare(b.name));
  if (!state.aiSelectedStartupId || !sorted.some((candidate) => candidate.id === state.aiSelectedStartupId)) {
    state.aiSelectedStartupId = state.scatterSelectedId && sorted.some((candidate) => candidate.id === state.scatterSelectedId)
      ? state.scatterSelectedId
      : sorted[0]?.id || null;
  }

  const current = state.aiSelectedStartupId;
  els.aiStartupSelect.innerHTML = '';
  sorted.forEach((candidate) => {
    const option = document.createElement('option');
    option.value = candidate.id;
    option.textContent = candidate.name;
    els.aiStartupSelect.appendChild(option);
  });
  if ([...els.aiStartupSelect.options].some((option) => option.value === current)) {
    els.aiStartupSelect.value = current;
  }

  const selectedCandidate = getCandidateById(state.aiSelectedStartupId);
  const queued = state.evaluationJobs.filter((job) => job.status === 'queued').length;
  const processing = state.evaluationJobs.filter((job) => job.status === 'processing').length;
  const completed = state.evaluationJobs.filter((job) => job.status === 'completed').length;
  const failed = state.evaluationJobs.filter((job) => job.status === 'failed').length;

  els.aiQueueBtn.disabled = !state.serverMode || !selectedCandidate || state.aiBusy;
  els.aiProcessNextBtn.disabled = !state.serverMode || state.aiBusy;
  els.aiRefreshBtn.disabled = state.aiBusy;

  const defaultStatus = !state.serverMode
    ? 'AI workflow is available only when the API server is active.'
    : state.aiBusy
      ? 'AI workflow is processing.'
      : selectedCandidate
        ? `Ready to evaluate ${selectedCandidate.name}. Queue depth: ${queued}.`
        : 'No startups are available for evaluation.';
  els.aiStatus.textContent = state.aiStatusText || defaultStatus;

  els.aiQueueSummary.innerHTML = [
    ['Queued', queued],
    ['Processing', processing],
    ['Completed', completed],
    ['Failed', failed],
  ].map(([label, value]) => `<div class="kpi"><div class="muted">${escapeHtml(label)}</div><strong>${escapeHtml(String(value))}</strong></div>`).join('');

  const latestEvaluation = state.evaluations.find((evaluation) => evaluation.startupId === state.aiSelectedStartupId);
  if (!latestEvaluation) {
    els.aiLatestEvaluation.innerHTML = '<div class="decision-item"><strong>Latest evaluation</strong><span>No completed evaluation for this startup yet.</span></div>';
  } else {
    const computed = latestEvaluation.summary?.computed || {};
    const analysis = latestEvaluation.summary?.analysis || {};
    els.aiLatestEvaluation.innerHTML = [
      ['Startup', selectedCandidate?.name || latestEvaluation.startupId],
      ['Source', latestEvaluation.summary?.source || 'system'],
      ['Provider', analysis.provider || '—'],
      ['Model', analysis.model || '—'],
      ['Generated', latestEvaluation.summary?.generatedAt ? new Date(latestEvaluation.summary.generatedAt).toLocaleString() : '—'],
      ['Total', fmt(computed.total)],
      ['Non-Financial', fmt(computed.nonFinancial)],
      ['Financial', fmt(computed.financial)],
      ['AI Confidence', analysis.confidence !== undefined ? fmt(Number(analysis.confidence) * 100, 0) + '%' : '—'],
      ['Summary', analysis.overallSummary || '—'],
      ['Strengths', Array.isArray(analysis.keyStrengths) && analysis.keyStrengths.length ? analysis.keyStrengths.join(' · ') : '—'],
      ['Risks', Array.isArray(analysis.keyRisks) && analysis.keyRisks.length ? analysis.keyRisks.join(' · ') : '—'],
    ].map(([label, value]) => `<div class="decision-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('');
  }

  const recentJobs = state.evaluationJobs.slice(0, 6);
  if (!recentJobs.length) {
    els.aiJobList.innerHTML = '<p class="muted">No evaluation jobs yet.</p>';
  } else {
    els.aiJobList.innerHTML = recentJobs.map((job) => {
      const candidate = getCandidateById(job.startupId);
      const status = job.status || 'queued';
      const meta = job.completedAt || job.startedAt || job.createdAt;
      return `
        <div class="job-item">
          <div>
            <strong>${escapeHtml(candidate?.name || job.startupId)}</strong>
            <div class="muted">${escapeHtml(job.requestedBy || 'system')} · ${escapeHtml(meta ? new Date(meta).toLocaleString() : 'pending')}</div>
          </div>
          <span class="job-status is-${escapeHtml(status)}">${escapeHtml(status)}</span>
        </div>
      `;
    }).join('');
  }

  if (!els.aiMetricSlots) return;
  if (!selectedCandidate) {
    els.aiMetricSlots.innerHTML = '<p class="muted">Select a startup to inspect scoring slots.</p>';
    return;
  }

  const metrics = getNewStartupMetrics();
  els.aiMetricSlots.innerHTML = metrics.map((metric) => {
    const analyst = num(selectedCandidate.scores?.[metric.column]);
    const external = num(selectedCandidate.externalScores?.[metric.column]);
    const ai = num(selectedCandidate.aiScores?.[metric.column]);
    const blended = scoringCore.resolveMetricScore(selectedCandidate, metric.column);
    const rationale = selectedCandidate.aiRationales?.[metric.column] || '';
    return `
      <div class="ai-metric-row">
        <div class="ai-metric-head">
          <strong>${escapeHtml(displayColumn(metric.column))} · ${escapeHtml(metric.label)}</strong>
          <span class="muted">Blended: ${escapeHtml(fmt(blended))}</span>
        </div>
        <div class="ai-metric-grid">
          <label>Analyst
            <div class="slot-readonly">${escapeHtml(fmt(analyst))}</div>
          </label>
          <label>External
            <select data-action="external-score" data-id="${escapeHtml(selectedCandidate.id)}" data-column="${escapeHtml(metric.column)}">
              ${SCORE_OPTIONS.map((value) => {
                const selected = (value === '' ? null : value) === external ? ' selected' : '';
                const text = value === '' ? '—' : String(value);
                return `<option value="${escapeHtml(String(value))}"${selected}>${escapeHtml(text)}</option>`;
              }).join('')}
            </select>
          </label>
          <label>AI
            <div class="slot-readonly">${escapeHtml(fmt(ai))}</div>
          </label>
        </div>
        ${rationale ? `<p class="chart-insight">${escapeHtml(rationale)}</p>` : ''}
      </div>
    `;
  }).join('');
}

function renderAnalysisActionBoard() {
  if (!els.analysisActionBoard) return;
  const ranked = [...state.candidates].sort((a, b) => b.computed.total - a.computed.total || a.name.localeCompare(b.name));
  if (!ranked.length) {
    els.analysisActionBoard.innerHTML = '<div class="selected-brief-empty">No startups available for triage.</div>';
    return;
  }

  const invest = ranked.filter((candidate) => decisionBucket(candidate) === 'invest').slice(0, 4);
  const watch = ranked
    .filter((candidate) => decisionBucket(candidate).startsWith('watch'))
    .sort((a, b) => nearThresholdDistance(a) - nearThresholdDistance(b))
    .slice(0, 4);
  const disagreement = ranked
    .map((candidate) => ({
      candidate,
      disagreement: disagreementSummary(candidate, 2),
    }))
    .filter((row) => row.disagreement.metrics.length)
    .sort((a, b) => b.disagreement.avgSpread - a.disagreement.avgSpread)
    .slice(0, 4);
  const coverageGaps = ranked
    .map((candidate) => ({
      candidate,
      notes: noteCoverageSummary(candidate),
      quality: pointQuality(candidate),
    }))
    .sort((a, b) => a.notes.filled - b.notes.filled || a.quality.coverage - b.quality.coverage)
    .slice(0, 4);

  const watchCount = ranked.filter((candidate) => decisionBucket(candidate).startsWith('watch')).length;
  const passCount = ranked.filter((candidate) => decisionBucket(candidate) === 'pass').length;
  const nearThresholdCount = ranked.filter((candidate) => nearThresholdDistance(candidate) <= 12).length;

  const listItem = (candidate, metaHtml = '') => `
    <div class="pipeline-item">
      <div class="pipeline-item-copy">
        <strong>${escapeHtml(candidate.name)}</strong>
        <span>${escapeHtml(decisionBucketLabel(decisionBucket(candidate)))} · Total ${escapeHtml(fmt(candidate.computed.total))} · ${escapeHtml(candidateStage(candidate))}</span>
        ${metaHtml}
      </div>
      <div class="pipeline-item-actions">
        <button class="ghost" type="button" data-action="analysis-open-pipeline" data-id="${escapeHtml(candidate.id)}">Open</button>
        <button class="ghost" type="button" data-action="analysis-compare-top" data-id="${escapeHtml(candidate.id)}">Compare</button>
        <button class="ghost" type="button" data-action="analysis-queue-ai" data-id="${escapeHtml(candidate.id)}"${state.serverMode ? '' : ' disabled'}>Queue AI</button>
      </div>
    </div>
  `;

  els.analysisActionBoard.innerHTML = `
    <div class="summary">
      <div class="kpi"><div class="muted">Invest</div><strong>${escapeHtml(String(invest.length))}</strong></div>
      <div class="kpi"><div class="muted">Watch</div><strong>${escapeHtml(String(watchCount))}</strong></div>
      <div class="kpi"><div class="muted">Pass</div><strong>${escapeHtml(String(passCount))}</strong></div>
      <div class="kpi"><div class="muted">Near Threshold</div><strong>${escapeHtml(String(nearThresholdCount))}</strong></div>
      <div class="kpi"><div class="muted">Queued AI Jobs</div><strong>${escapeHtml(String(state.evaluationJobs.filter((job) => job.status === 'queued').length))}</strong></div>
      <div class="kpi"><div class="muted">High Disagreement</div><strong>${escapeHtml(String(disagreement.length))}</strong></div>
    </div>
    <div class="pipeline-board-grid">
      <div class="pipeline-column">
        <h4>Invest Priority</h4>
        <p class="muted">Best current fit for partner review and deeper diligence.</p>
        <div class="pipeline-list">
          ${invest.length ? invest.map((candidate) => {
            const confidence = evaluationSignalSummary(candidate).confidence;
            const confidenceText = confidence !== null && confidence !== undefined
              ? `${fmt(confidence * 100, 0)}% confidence`
              : 'AI confidence pending';
            return listItem(candidate, `<span>${escapeHtml(quadrantOf(candidate))} · ${escapeHtml(confidenceText)}</span>`);
          }).join('') : '<p class="muted">No invest-priority startups yet.</p>'}
        </div>
      </div>
      <div class="pipeline-column">
        <h4>Near Threshold</h4>
        <p class="muted">Closest to flipping into a stronger decision zone.</p>
        <div class="pipeline-list">
          ${watch.length ? watch.map((candidate) => listItem(candidate, `<span>${escapeHtml(fmt(nearThresholdDistance(candidate), 0))} points from threshold</span>`)).join('') : '<p class="muted">No near-threshold startups right now.</p>'}
        </div>
      </div>
      <div class="pipeline-column">
        <h4>Highest Disagreement</h4>
        <p class="muted">Analyst, external, and AI scores are not aligned.</p>
        <div class="pipeline-list">
          ${disagreement.length ? disagreement.map(({ candidate, disagreement: summary }) => listItem(candidate, `<span>${escapeHtml(summary.metrics.map((metric) => `${displayColumn(metric.column)} ${metric.label}`).join(' · '))}</span>`)).join('') : '<p class="muted">No material scoring disagreement yet.</p>'}
        </div>
      </div>
      <div class="pipeline-column">
        <h4>Coverage Gaps</h4>
        <p class="muted">Analyst notes or evidence coverage need attention.</p>
        <div class="pipeline-list">
          ${coverageGaps.length ? coverageGaps.map(({ candidate, notes, quality }) => listItem(candidate, `<span>${escapeHtml(String(notes.filled))}/${escapeHtml(String(notes.total))} notes · ${escapeHtml(fmt(quality.coverage * 100, 0))}% coverage</span>`)).join('') : '<p class="muted">No coverage gaps surfaced.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderAnalysisPanels() {
  renderRanking();
  renderDistribution();
  renderQuadrantPieChart();
  renderRankingContributionChart();
  renderOpportunityChart();
  renderSelectedStartupBrief();
  renderAnalysisActionBoard();
  renderAiWorkflow();
}

function renderSelectedStartupBrief() {
  if (!els.selectedStartupBrief) return;

  const candidate = getCandidateById(state.scatterSelectedId);
  els.briefCompareBtn.disabled = !candidate || state.candidates.length < 2;
  els.briefPipelineBtn.disabled = !candidate;

  if (!candidate) {
    els.selectedStartupBrief.className = 'selected-brief-empty';
    els.selectedStartupBrief.innerHTML = 'Select a startup from the scatter to open its analyst brief.';
    return;
  }

  const quality = pointQuality(candidate);
  const notes = noteCoverageSummary(candidate);
  const quadrant = quadrantOf(candidate);
  const leaders = topMetricContributors(candidate);
  const gaps = fastestImprovementGaps(candidate);
  const benchmark = topCandidateExcluding(candidate.id);
  const latestEvaluation = latestEvaluationFor(candidate.id);
  const aiSummary = latestEvaluation?.summary?.analysis?.overallSummary || 'No AI evaluation summary yet.';
  const tags = candidateTags(candidate);
  const stage = candidateStage(candidate);
  const topDelta = benchmark ? candidate.computed.total - benchmark.computed.total : 0;

  els.selectedStartupBrief.className = 'selected-brief-grid';
  els.selectedStartupBrief.innerHTML = `
    <div class="selected-brief-primary">
      <div class="selected-brief-heading">
        <div>
          <h4>${escapeHtml(candidate.name)}</h4>
          <p>${escapeHtml(stage)} · ${escapeHtml(quadrant)}</p>
        </div>
        <div class="selected-brief-chips">
          ${tags.length ? tags.map((tag) => `<span class="brief-chip">${escapeHtml(tag)}</span>`).join('') : '<span class="brief-chip is-muted">No tags</span>'}
        </div>
      </div>
      <div class="selected-brief-kpis">
        <div class="kpi"><div class="muted">Total</div><strong>${escapeHtml(fmt(candidate.computed.total))}</strong></div>
        <div class="kpi"><div class="muted">Non-Fin</div><strong>${escapeHtml(fmt(candidate.computed.nonFinancial))}</strong></div>
        <div class="kpi"><div class="muted">Fin</div><strong>${escapeHtml(fmt(candidate.computed.financial))}</strong></div>
        <div class="kpi"><div class="muted">Notes</div><strong>${escapeHtml(String(notes.filled))}/${escapeHtml(String(notes.total))}</strong></div>
      </div>
    </div>
    <div class="selected-brief-insights">
      <div class="decision-item">
        <strong>Portfolio standing</strong>
        <span>${benchmark ? `${topDelta >= 0 ? '+' : ''}${fmt(topDelta)} vs top-ranked ${benchmark.name}` : 'Current top-ranked startup'}</span>
      </div>
      <div class="decision-item">
        <strong>Coverage quality</strong>
        <span>${fmt(quality.coverage * 100, 0)}% metric coverage across scored inputs</span>
      </div>
      <div class="decision-item">
        <strong>Strongest weighted drivers</strong>
        <span>${leaders.length ? leaders.map((metric) => `${displayColumn(metric.column)} ${metric.label}`).join(' · ') : 'No weighted drivers yet'}</span>
      </div>
      <div class="decision-item">
        <strong>Fastest score uplift areas</strong>
        <span>${gaps.length ? gaps.map((metric) => `${displayColumn(metric.column)} ${metric.label}`).join(' · ') : 'Already at max score on visible metrics'}</span>
      </div>
      <div class="decision-item">
        <strong>AI readout</strong>
        <span>${escapeHtml(aiSummary)}</span>
      </div>
    </div>
  `;
}

function ensureCompareSelection() {
  if (!state.compareA || !state.candidates.some((c) => c.id === state.compareA)) {
    state.compareA = state.candidates[0]?.id || null;
  }
  if (!state.compareB || !state.candidates.some((c) => c.id === state.compareB) || state.compareB === state.compareA) {
    state.compareB = state.candidates.find((c) => c.id !== state.compareA)?.id || state.compareA;
  }
}

function renderCompare() {
  ensureCompareSelection();
  const compareMetrics = getNewStartupMetrics();
  const sorted = [...state.candidates].sort((a, b) => a.name.localeCompare(b.name));

  for (const [el, value] of [[els.compareA, state.compareA], [els.compareB, state.compareB]]) {
    el.innerHTML = '';
    sorted.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      el.appendChild(o);
    });
    if ([...el.options].some((o) => o.value === value)) el.value = value;
  }
  els.compareMode.value = state.compareMode;

  const a = state.candidates.find((c) => c.id === state.compareA);
  const b = state.candidates.find((c) => c.id === state.compareB);
  if (!a || !b) return;

  const winsA = compareMetrics.filter((m) => (scoringCore.resolveMetricScore(a, m.column) ?? 0) > (scoringCore.resolveMetricScore(b, m.column) ?? 0)).length;
  const winsB = compareMetrics.filter((m) => (scoringCore.resolveMetricScore(b, m.column) ?? 0) > (scoringCore.resolveMetricScore(a, m.column) ?? 0)).length;
  const ties = compareMetrics.length - winsA - winsB;
  const cards = [
    ['A Total', fmt(a.computed.total)],
    ['B Total', fmt(b.computed.total)],
    ['Delta', fmt(a.computed.total - b.computed.total)],
    ['NF Delta', fmt(a.computed.nonFinancial - b.computed.nonFinancial)],
    ['F Delta', fmt(a.computed.financial - b.computed.financial)],
    ['Wins', `${winsA}-${winsB} (${ties} ties)`],
  ];
  els.compareSummary.innerHTML = cards.map(([k, v]) => `<div class="kpi"><div class="muted">${escapeHtml(k)}</div><strong>${escapeHtml(String(v))}</strong></div>`).join('');

  const deltas = compareMetrics.map((m) => {
    const wa = (scoringCore.resolveMetricScore(a, m.column) ?? 0) * (Number(m.weight) || 0);
    const wb = (scoringCore.resolveMetricScore(b, m.column) ?? 0) * (Number(m.weight) || 0);
    return { label: m.label, delta: wa - wb };
  });
  const strengths = [...deltas].sort((x, y) => y.delta - x.delta).slice(0, 3).filter((d) => d.delta > 0);
  const risks = [...deltas].sort((x, y) => x.delta - y.delta).slice(0, 3).filter((d) => d.delta < 0);
  const winner = a.computed.total === b.computed.total ? 'Tie' : (a.computed.total > b.computed.total ? a.name : b.name);
  if (els.decisionSummary) {
    els.decisionSummary.innerHTML = [
      ['Winner by weighted score', winner],
      ['Biggest strengths', strengths.length ? strengths.map((s) => `${s.label} (+${fmt(s.delta)})`).join(' · ') : 'None'],
      ['Biggest risks', risks.length ? risks.map((r) => `${r.label} (${fmt(r.delta)})`).join(' · ') : 'None'],
    ].map(([k, v]) => `<div class="decision-item"><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`).join('');
  }
  if (els.compareHeatmap) {
    const maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d.delta)));
    els.compareHeatmap.innerHTML = deltas.map((d) => {
      const ratio = Math.abs(d.delta) / maxAbs;
      const tone = d.delta >= 0
        ? `rgba(5, 150, 105, ${0.15 + ratio * 0.55})`
        : `rgba(220, 38, 38, ${0.15 + ratio * 0.55})`;
      const val = d.delta > 0 ? `+${fmt(d.delta)}` : fmt(d.delta);
      return `<div class="heat-cell" style="background:${tone}"><strong>${escapeHtml(d.label)}</strong><span>${escapeHtml(val)}</span></div>`;
    }).join('');
  }
  if (els.compareEvidence) {
    els.compareEvidence.innerHTML = compareMetrics.map((metric) => {
      const analystA = num(a.scores?.[metric.column]);
      const externalA = num(a.externalScores?.[metric.column]);
      const aiA = num(a.aiScores?.[metric.column]);
      const analystB = num(b.scores?.[metric.column]);
      const externalB = num(b.externalScores?.[metric.column]);
      const aiB = num(b.aiScores?.[metric.column]);
      const scoreA = scoringCore.resolveMetricScore(a, metric.column) ?? 0;
      const scoreB = scoringCore.resolveMetricScore(b, metric.column) ?? 0;
      const delta = state.compareMode === 'weighted'
        ? (scoreA - scoreB) * (Number(metric.weight) || 0)
        : (scoreA - scoreB);
      const noteA = String(a.notes?.[metric.column] || '').trim() || 'No analyst note.';
      const noteB = String(b.notes?.[metric.column] || '').trim() || 'No analyst note.';
      const aiNoteA = String(a.aiRationales?.[metric.column] || '').trim();
      const aiNoteB = String(b.aiRationales?.[metric.column] || '').trim();
      const sign = delta > 0 ? '+' : '';
      const tone = delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : 'is-flat';
      return `
        <div class="compare-evidence-row">
          <div class="compare-evidence-head">
            <div>
              <strong>${escapeHtml(displayColumn(metric.column))} · ${escapeHtml(metric.label)}</strong>
              <span class="muted">Weight ${escapeHtml(fmt(metric.weight, 0))}</span>
            </div>
            <span class="compare-evidence-delta ${tone}">${escapeHtml(sign)}${escapeHtml(fmt(delta))} ${state.compareMode === 'weighted' ? 'weighted' : 'raw'} delta</span>
          </div>
          <div class="compare-evidence-grid">
            <div class="compare-evidence-startup">
              <h4>${escapeHtml(a.name)}</h4>
              <div class="compare-evidence-kpis">
                <span>Blended ${escapeHtml(fmt(scoreA))}</span>
                <span>Analyst ${escapeHtml(fmt(analystA))}</span>
                <span>External ${escapeHtml(fmt(externalA))}</span>
                <span>AI ${escapeHtml(fmt(aiA))}</span>
              </div>
              <p>${escapeHtml(noteA)}</p>
              ${aiNoteA ? `<div class="compare-ai-note">AI: ${escapeHtml(aiNoteA)}</div>` : ''}
            </div>
            <div class="compare-evidence-startup">
              <h4>${escapeHtml(b.name)}</h4>
              <div class="compare-evidence-kpis">
                <span>Blended ${escapeHtml(fmt(scoreB))}</span>
                <span>Analyst ${escapeHtml(fmt(analystB))}</span>
                <span>External ${escapeHtml(fmt(externalB))}</span>
                <span>AI ${escapeHtml(fmt(aiB))}</span>
              </div>
              <p>${escapeHtml(noteB)}</p>
              ${aiNoteB ? `<div class="compare-ai-note">AI: ${escapeHtml(aiNoteB)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  const metrics = compareMetrics;
  const labels = metrics.map((m) => ({
    short: displayColumn(m.column),
    name: m.label,
    column: m.column,
  }));
  const valsA = metrics.map((m) => {
    const s = scoringCore.resolveMetricScore(a, m.column) ?? 0;
    return state.compareMode === 'weighted' ? s * (Number(m.weight) || 0) : s;
  });
  const valsB = metrics.map((m) => {
    const s = scoringCore.resolveMetricScore(b, m.column) ?? 0;
    return state.compareMode === 'weighted' ? s * (Number(m.weight) || 0) : s;
  });

  const { ctx, width: W, height: H } = prepareCanvas(els.compareCanvas);
  const pad = { l: 54, r: 18, t: 20, b: 116 };
  const plot = { x: pad.l, y: pad.t, w: W - pad.l - pad.r, h: H - pad.t - pad.b };
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  const maxV = Math.max(1, ...valsA, ...valsB);
  const gw = plot.w / labels.length;
  const bw = Math.max(8, gw * 0.34);
  ctx.strokeStyle = 'rgba(15,23,42,0.1)';
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h * i / 4;
    ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke();
  }

  const fitText = (text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 3 && ctx.measureText(`${out}…`).width > maxWidth) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  };

  const wrapMetricName = (text, maxWidth, maxLines = 2) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let i = 0;
    for (let ln = 0; ln < maxLines && i < words.length; ln++) {
      let line = words[i++];
      while (i < words.length) {
        const next = `${line} ${words[i]}`;
        if (ctx.measureText(next).width > maxWidth) break;
        line = next;
        i += 1;
      }
      lines.push(line);
    }
    if (i < words.length) {
      lines[maxLines - 1] = fitText(`${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, maxWidth);
    }
    return lines;
  };

  labels.forEach((lb, i) => {
    const cx = plot.x + i * gw + gw / 2;
    const hA = (valsA[i] / maxV) * plot.h;
    const hB = (valsB[i] / maxV) * plot.h;

    ctx.fillStyle = 'rgba(47,107,255,0.35)';
    ctx.fillRect(cx - bw - 2, plot.y + plot.h - hA, bw, hA);
    ctx.strokeStyle = '#2f6bff';
    ctx.strokeRect(cx - bw - 2, plot.y + plot.h - hA, bw, hA);

    ctx.fillStyle = 'rgba(0,163,163,0.35)';
    ctx.fillRect(cx + 2, plot.y + plot.h - hB, bw, hB);
    ctx.strokeStyle = '#00a3a3';
    ctx.strokeRect(cx + 2, plot.y + plot.h - hB, bw, hB);

    const laneWidth = Math.max(36, gw - 8);
    const metricName = fitText(lb.name, laneWidth);

    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.font = '11px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(lb.short, cx, H - 50);

    const nameLines = wrapMetricName(metricName, laneWidth, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - laneWidth / 2, H - 34, laneWidth, 28);
    ctx.clip();
    ctx.fillStyle = '#64748b';
    ctx.font = '9.5px "Helvetica Neue", Helvetica, Arial, sans-serif';
    nameLines.forEach((line, lineIndex) => {
      ctx.fillText(line, cx, H - 24 + lineIndex * 12);
    });
    ctx.restore();
  });
}

function scoreSelect(value, onChange) {
  const s = document.createElement('select');
  SCORE_OPTIONS.forEach((v) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v === '' ? '—' : String(v);
    s.appendChild(o);
  });
  s.value = value === null || value === undefined ? '' : String(value);
  s.addEventListener('change', () => onChange(num(s.value)));
  return s;
}

function emptyDraft() {
  return {
    scores: Object.fromEntries(getMetrics().map((m) => [m.column, null])),
    externalScores: Object.fromEntries(getMetrics().map((m) => [m.column, null])),
    aiScores: Object.fromEntries(getMetrics().map((m) => [m.column, null])),
    notes: Object.fromEntries(getMetrics().map((m) => [m.column, ''])),
  };
}

function templateScores(key) {
  const cols = getMetrics().map((m) => m.column);
  if (key === 'blank') return Object.fromEntries(cols.map((c) => [c, null]));
  if (key === 'premium') return Object.fromEntries(cols.map((c) => [c, c === 'L' ? null : 5]));
  if (key === 'traction') return { B: 3, C: 3, D: 3, E: 5, F: 5, G: 3, H: 5, I: 5, J: 3, K: 3, L: null };
  if (key === 'potential') return { B: 5, C: 3, D: 3, E: 3, F: 5, G: 5, H: 1, I: 1, J: 1, K: 1, L: null };
  return Object.fromEntries(cols.map((c) => [c, 3]));
}

function buildDraftFromSelections() {
  const draft = emptyDraft();
  const cloneId = state.newDraftMeta.clone || '';
  const cloneC = state.candidates.find((c) => c.id === cloneId) || null;
  const tScores = templateScores(state.newDraftMeta.template || 'balanced');

  getNewStartupMetrics().forEach((m, index) => {
    if (cloneC) {
      draft.scores[m.column] = num(cloneC.scores[m.column]) ?? tScores[m.column] ?? null;
      draft.externalScores[m.column] = num(cloneC.externalScores?.[m.column]) ?? null;
      draft.aiScores[m.column] = num(cloneC.aiScores?.[m.column]) ?? null;
      draft.notes[m.column] = (cloneC.notes?.[m.column] || '').trim();
    } else {
      draft.scores[m.column] = tScores[m.column] ?? null;
      draft.externalScores[m.column] = null;
      draft.aiScores[m.column] = null;
      draft.notes[m.column] = state.newDraftMeta.notesMode === 'rubric'
        ? newStartupPrompt(m, index)
        : '';
    }
  });

  state.newDraft = draft;
}

function getNewStartupSections() {
  const metrics = getNewStartupMetrics();
  return [
    { key: 'core', title: 'Core', metrics: metrics.slice(0, 2), open: true },
    { key: 'market', title: 'Market', metrics: metrics.slice(2, 4), open: false },
    { key: 'financial', title: 'Financial', metrics: metrics.slice(4, 6), open: false },
    { key: 'exit', title: 'Exit', metrics: metrics.slice(6, 8), open: false },
  ].filter((s) => s.metrics.length > 0);
}

function sectionCompletion(metrics, draft) {
  let done = 0;
  let missingScores = 0;
  let missingNotes = 0;
  metrics.forEach((m) => {
    const scoreFilled = num(draft.scores[m.column]) !== null;
    const noteFilled = Boolean((draft.notes[m.column] || '').trim());
    if (scoreFilled && noteFilled) done += 1;
    if (!scoreFilled) missingScores += 1;
    if (!noteFilled) missingNotes += 1;
  });
  return { done, total: metrics.length, missingScores, missingNotes };
}

function renderNewForm() {
  const templates = [
    ['balanced', 'Balanced (all 3)'],
    ['blank', 'Blank'],
    ['potential', 'High Potential'],
    ['traction', 'Traction'],
    ['premium', 'Premium Benchmark'],
  ];

  if (!els.newTemplate.dataset.init) {
    els.newTemplate.innerHTML = '';
    templates.forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      els.newTemplate.appendChild(o);
    });
    els.newTemplate.value = 'balanced';
    els.newTemplate.dataset.init = '1';
  }
  els.newName.value = state.newDraftMeta.name || '';
  els.newTemplate.value = state.newDraftMeta.template || 'balanced';

  els.newClone.innerHTML = '<option value="">None</option>';
  [...state.candidates].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    els.newClone.appendChild(o);
  });
  if ([...els.newClone.options].some((o) => o.value === state.newDraftMeta.clone)) els.newClone.value = state.newDraftMeta.clone;
  else els.newClone.value = '';
  els.newNotesMode.value = state.newDraftMeta.notesMode || 'empty';

  if (!state.newDraft) buildDraftFromSelections();
  renderNewDraftStatus();
  renderNewDraftPicker();

  els.newMetrics.innerHTML = '';
  const sections = getNewStartupSections();
  sections.forEach((section) => {
    const block = document.createElement('details');
    block.className = 'new-section';
    block.dataset.section = section.key;
    block.open = section.open;

    const comp = sectionCompletion(section.metrics, state.newDraft);
    const allDone = comp.done === comp.total && comp.total > 0;
    const blockingText = `${comp.missingScores} scores missing · ${comp.missingNotes} explanations missing`;
    const summary = document.createElement('summary');
    summary.className = 'new-section-summary';
    summary.innerHTML = `
      <span>
        <span class="new-section-title">${escapeHtml(section.title)}</span>
        <span class="new-section-required ${allDone ? 'is-done' : ''}">
          ${allDone ? 'All required fields complete' : escapeHtml(blockingText)}
        </span>
      </span>
      <span class="new-section-status ${allDone ? 'is-done' : ''}">
        ${escapeHtml(String(comp.done))}/${escapeHtml(String(comp.total))} complete
      </span>
    `;
    block.appendChild(summary);

    section.metrics.forEach((m, metricIndex) => {
      const row = document.createElement('div');
      row.className = 'metric-row';

      const head = document.createElement('div');
      head.className = 'metric-head';
      head.innerHTML = `<span>${escapeHtml(displayColumn(m.column))} · ${escapeHtml(m.label)}</span><span class="muted">Weight: ${escapeHtml(String(m.weight))}</span>`;

      const sl = document.createElement('label');
      sl.textContent = 'Analyst Score';
      const select = scoreSelect(state.newDraft.scores[m.column], (v) => { state.newDraft.scores[m.column] = v; });
      select.dataset.metric = m.column;
      select.dataset.role = 'analyst-score';
      select.addEventListener('change', () => {
        scheduleNewDraftPersist();
        renderNewForm();
      });
      sl.appendChild(select);

      const exl = document.createElement('label');
      exl.textContent = 'External Score';
      const externalSelect = scoreSelect(state.newDraft.externalScores[m.column], (v) => { state.newDraft.externalScores[m.column] = v; });
      externalSelect.dataset.metric = m.column;
      externalSelect.dataset.role = 'external-score';
      externalSelect.addEventListener('change', scheduleNewDraftPersist);
      exl.appendChild(externalSelect);

      const nl = document.createElement('label');
      nl.textContent = 'Explanation';
      const ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = newStartupPrompt(m, getNewStartupMetrics().indexOf(m));
      ta.value = state.newDraft.notes[m.column] || '';
      ta.dataset.metric = m.column;
      ta.dataset.role = 'note';
      ta.addEventListener('input', () => {
        state.newDraft.notes[m.column] = ta.value;
        scheduleNewDraftPersist();
        refreshNewSectionStatuses();
      });
      nl.appendChild(ta);

      const hint = document.createElement('p');
      hint.className = 'metric-evidence-hint';
      hint.textContent = newStartupPrompt(m, getNewStartupMetrics().indexOf(m));
      nl.appendChild(hint);

      const ail = document.createElement('label');
      ail.textContent = 'AI Score';
      const aiValue = document.createElement('div');
      aiValue.className = 'slot-readonly';
      aiValue.textContent = state.newDraft.aiScores[m.column] === null || state.newDraft.aiScores[m.column] === undefined
        ? 'Pending after AI evaluation'
        : String(state.newDraft.aiScores[m.column]);
      ail.appendChild(aiValue);

      row.append(head, sl, exl, ail, nl);
      block.appendChild(row);
    });

    els.newMetrics.appendChild(block);
  });

  const rubrics = getRubrics().filter((r) => getNewStartupMetrics().some((m) => m.column === r.column));
  const current = els.guideMetric.value || rubrics[0]?.column;
  els.guideMetric.innerHTML = '';
  rubrics.forEach((r) => {
    const o = document.createElement('option');
    o.value = r.column;
    o.textContent = `${displayColumn(r.column)} · ${r.label}`;
    els.guideMetric.appendChild(o);
  });
  if ([...els.guideMetric.options].some((o) => o.value === current)) els.guideMetric.value = current;
  renderGuide();
}

function refreshNewSectionStatuses() {
  const sections = getNewStartupSections();
  sections.forEach((section) => {
    const block = els.newMetrics.querySelector(`.new-section[data-section="${section.key}"]`);
    if (!block) return;
    const comp = sectionCompletion(section.metrics, state.newDraft);
    const allDone = comp.done === comp.total && comp.total > 0;
    const status = block.querySelector('.new-section-status');
    const required = block.querySelector('.new-section-required');
    if (status) {
      status.textContent = `${comp.done}/${comp.total} complete`;
      status.classList.toggle('is-done', allDone);
    }
    if (required) {
      required.textContent = allDone
        ? 'All required fields complete'
        : `${comp.missingScores} scores missing · ${comp.missingNotes} explanations missing`;
      required.classList.toggle('is-done', allDone);
    }
  });
}

function renderGuide() {
  const r = getRubrics().find((x) => x.column === els.guideMetric.value);
  els.guideText.textContent = r?.rubric || 'No rubric available.';
}

function setFeedback(msg, type = 'neutral') {
  els.newFeedback.textContent = msg;
  els.newFeedback.dataset.type = type;
}

function validateDraft() {
  for (const m of getNewStartupMetrics()) {
    const s = num(state.newDraft.scores[m.column]);
    const n = (state.newDraft.notes[m.column] || '').trim();
    if (s === null) return { ok: false, message: `Missing score for ${displayColumn(m.column)}.`, metric: m.column, role: 'analyst-score' };
    if (!n) return { ok: false, message: `Missing explanation for ${displayColumn(m.column)}.`, metric: m.column, role: 'note' };
  }
  return { ok: true };
}

function focusDraftField(metric, role) {
  const el = els.newMetrics.querySelector(`[data-metric="${metric}"][data-role="${role}"]`);
  el?.focus();
}

function uniqueName(name) {
  const base = (name || '').trim();
  if (!base) return '';
  const set = new Set(state.candidates.map((c) => c.name.trim().toLowerCase()));
  if (!set.has(base.toLowerCase())) return base;
  let i = 2;
  while (set.has(`${base} (${i})`.toLowerCase())) i += 1;
  return `${base} (${i})`;
}

function candidateTags(candidate) {
  return Array.isArray(candidate.tags) ? candidate.tags.filter(Boolean) : [];
}

function candidateStage(candidate) {
  return candidate.stage || 'sourcing';
}

function passesSavedView(candidate) {
  const quality = pointQuality(candidate);
  if (state.savedView === 'ic-ready') {
    return quadrantOf(candidate) === 'top-right'
      && candidate.computed.total >= scoringCore.median(state.candidates.map((c) => c.computed.total))
      && quality.coverage >= 0.9
      && quality.confidence >= 0.8;
  }
  if (state.savedView === 'needs-diligence') {
    return quality.coverage < 1 || quality.confidence < 0.75 || candidateStage(candidate) === 'diligence';
  }
  if (state.savedView === 'financial-weak') {
    return candidate.computed.financial < Number(state.thresholds.f || 0);
  }
  return true;
}

function selectedRowSet() {
  return new Set(state.selectedRows);
}

function visibleSelectedCount(rows) {
  const set = selectedRowSet();
  return rows.filter((row) => set.has(row.id)).length;
}

function normalizeTagList(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean))];
}

function applyTagToSelected(tags) {
  const set = selectedRowSet();
  if (!set.size || !tags.length) return;
  state.candidates.forEach((candidate) => {
    if (!set.has(candidate.id)) return;
    const merged = new Set([...candidateTags(candidate), ...tags]);
    candidate.tags = [...merged];
  });
}

function applyStageToSelected(stage) {
  const set = selectedRowSet();
  if (!set.size || !stage) return;
  state.candidates.forEach((candidate) => {
    if (set.has(candidate.id)) candidate.stage = stage;
  });
}

function deleteSelectedRows() {
  const set = selectedRowSet();
  if (!set.size) return;
  state.candidates = state.candidates.filter((candidate) => !set.has(candidate.id));
  state.selectedRows = [];
  ensureCompareSelection();
  recomputeAll();
}

function weightPresets() {
  return {
    balanced: { B: 9, C: 7, D: 7, E: 7, F: 5, G: 3, H: 5, I: 3, J: 5, K: 1, L: 7 },
    conservative: { B: 8, C: 8, D: 8, E: 6, F: 4, G: 4, H: 7, I: 6, J: 6, K: 4, L: 4 },
    growth: { B: 9, C: 6, D: 5, E: 8, F: 7, G: 7, H: 3, I: 2, J: 4, K: 3, L: 6 },
  };
}

function loadWeightPreset(key) {
  const preset = weightPresets()[key] || weightPresets().balanced;
  getMetrics().forEach((metric) => {
    const fallback = state.draftWeights[metric.column] ?? Number(metric.weight) ?? 0;
    state.draftWeights[metric.column] = preset[metric.column] ?? fallback;
  });
  state.weightPreset = key;
}

function draftWeightsChanged() {
  return getMetrics().some((metric) => Number(metric.weight) !== Number(state.draftWeights[metric.column] ?? 0));
}

function previewRankChanges() {
  if (state.serverMode && Array.isArray(state.weightPreviewData)) return state.weightPreviewData;
  const draftMap = Object.fromEntries(getMetrics().map((metric) => [metric.column, Number(state.draftWeights[metric.column] ?? 0)]));
  const currentRanked = [...state.candidates].sort((a, b) => b.computed.total - a.computed.total);
  const currentRank = new Map(currentRanked.map((candidate, index) => [candidate.id, index + 1]));
  const draftRanked = state.candidates.map((candidate) => ({
    candidate,
    preview: scoringCore.computeScoresWithWeights(candidate, draftMap),
  })).sort((a, b) => b.preview.total - a.preview.total);
  const movers = draftRanked.map((entry, index) => {
    const previous = currentRank.get(entry.candidate.id) || index + 1;
    return {
      name: entry.candidate.name,
      before: previous,
      after: index + 1,
      delta: previous - (index + 1),
      totalDelta: entry.preview.total - entry.candidate.computed.total,
    };
  }).filter((entry) => entry.delta !== 0 || Math.abs(entry.totalDelta) > 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || Math.abs(b.totalDelta) - Math.abs(a.totalDelta));
  return movers.slice(0, 5);
}

async function refreshWeightPreview() {
  if (!state.serverMode) {
    state.weightPreviewData = null;
    renderWeights();
    return;
  }
  try {
    const preview = await apiJson(WEIGHTS_PREVIEW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.draftWeights),
    });
    state.weightPreviewData = Array.isArray(preview) ? preview.slice(0, 5).map((item) => ({
      name: item.name,
      before: item.before,
      after: item.after,
      delta: item.movement,
      totalDelta: 0,
    })) : null;
  } catch (error) {
    console.error(error);
    state.weightPreviewData = null;
  }
  renderWeights();
}

function renderTable() {
  const rows = visibleCandidates();
  ensureTableSelection(rows);
  const thead = els.table.querySelector('thead');
  const tbody = els.table.querySelector('tbody');
  const selection = selectedRowSet();
  const selectedVisible = visibleSelectedCount(rows);
  const selectedTotal = state.selectedRows.length;

  thead.innerHTML = '<tr><th><input id="tableSelectAll" type="checkbox" /></th><th>Rank</th><th>Name</th><th>Tags</th><th>Stage</th><th>Non-Fin</th><th>Fin</th><th>Total</th><th>Quadrant</th><th>Actions</th></tr>';
  tbody.innerHTML = '';
  els.selectionStatus.textContent = `${selectedTotal} selected`;
  els.selectVisibleToggle.checked = rows.length > 0 && selectedVisible === rows.length;
  els.bulkTagBtn.disabled = selectedTotal === 0;
  els.bulkStageBtn.disabled = selectedTotal === 0;
  els.bulkDeleteBtn.disabled = selectedTotal === 0;

  rows.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.className = c.id === state.selectedTableStartupId ? 'is-selected-row' : '';
    tr.dataset.id = c.id;
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');

    const tdCheck = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selection.has(c.id);
    checkbox.dataset.action = 'toggle-select';
    checkbox.dataset.id = c.id;
    tdCheck.appendChild(checkbox);

    const tdRank = document.createElement('td');
    tdRank.textContent = String(i + 1);

    const tdName = document.createElement('td');
    const inp = document.createElement('input');
    inp.value = c.name;
    inp.addEventListener('change', async () => {
      const nextName = uniqueName(inp.value);
      if (!nextName) {
        inp.value = c.name;
        return;
      }
      if (state.serverMode) {
        try {
          const saved = await updateStartupRemote(c.id, { name: nextName });
          Object.assign(c, saved);
        } catch (error) {
          alert(error.message);
          inp.value = c.name;
          return;
        }
      } else {
        c.name = nextName;
      }
      recomputeAll();
      save();
      renderAll();
    });
    tdName.appendChild(inp);

    const tdTags = document.createElement('td');
    const tagInput = document.createElement('input');
    tagInput.value = candidateTags(c).join(', ');
    tagInput.placeholder = 'Add tags';
    tagInput.dataset.action = 'edit-tags';
    tagInput.dataset.id = c.id;
    tdTags.appendChild(tagInput);

    const tdStage = document.createElement('td');
    const stageSelect = document.createElement('select');
    ['sourcing', 'diligence', 'ic-ready', 'watchlist', 'pass'].forEach((stage) => {
      const option = document.createElement('option');
      option.value = stage;
      option.textContent = stage;
      stageSelect.appendChild(option);
    });
    stageSelect.value = candidateStage(c);
    stageSelect.dataset.action = 'edit-stage';
    stageSelect.dataset.id = c.id;
    tdStage.appendChild(stageSelect);

    const tdNF = document.createElement('td'); tdNF.textContent = fmt(c.computed.nonFinancial);
    const tdF = document.createElement('td'); tdF.textContent = fmt(c.computed.financial);
    const tdT = document.createElement('td'); tdT.innerHTML = `<span class="score-chip">${fmt(c.computed.total)}</span>`;
    const tdQ = document.createElement('td'); tdQ.textContent = quadrantOf(c);

    const tdA = document.createElement('td');
    const rm = document.createElement('button');
    rm.className = 'remove-btn';
    rm.textContent = 'Remove';
    rm.type = 'button';
    rm.addEventListener('click', async () => {
      if (state.serverMode) {
        try {
          await apiJson(`${STARTUPS_URL}/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
        } catch (error) {
          alert(error.message);
          return;
        }
      }
      state.candidates = state.candidates.filter((x) => x.id !== c.id);
      ensureCompareSelection();
      recomputeAll();
      save();
      renderAll();
      refreshRemoteDerivedData({ workflow: true }).catch(console.error);
    });
    tdA.appendChild(rm);

    tr.append(tdCheck, tdRank, tdName, tdTags, tdStage, tdNF, tdF, tdT, tdQ, tdA);
    tbody.appendChild(tr);
  });

  const headerToggle = document.getElementById('tableSelectAll');
  if (headerToggle) headerToggle.checked = rows.length > 0 && selectedVisible === rows.length;
  renderTableDetail();
}

function renderTableDetail() {
  if (!els.tableDetailPanel) return;
  const rows = visibleCandidates();
  const candidate = ensureTableSelection(rows);
  els.tableDetailCompareBtn.disabled = !candidate || state.candidates.length < 2;
  els.tableDetailQueueBtn.disabled = !candidate || !state.serverMode;

  if (!candidate) {
    els.tableDetailPanel.className = 'selected-brief-empty';
    els.tableDetailPanel.innerHTML = 'Select a startup row to inspect its pipeline detail.';
    return;
  }

  const quality = pointQuality(candidate);
  const notes = noteCoverageSummary(candidate);
  const topDrivers = topMetricContributors(candidate, 4);
  const topGaps = fastestImprovementGaps(candidate, 4);
  const signalSummary = evaluationSignalSummary(candidate);
  const stage = candidateStage(candidate);
  const tags = candidateTags(candidate);
  const evaluationMatrix = visibleTableMetrics().map((metric) => {
    const analyst = num(candidate.scores?.[metric.column]);
    const external = num(candidate.externalScores?.[metric.column]);
    const ai = num(candidate.aiScores?.[metric.column]);
    const blended = scoringCore.resolveMetricScore(candidate, metric.column);
    const spreadValues = [analyst, external, ai].filter((value) => value !== null);
    const spread = spreadValues.length >= 2 ? Math.max(...spreadValues) - Math.min(...spreadValues) : 0;
    return `
      <div class="evaluation-matrix-row">
        <strong>${escapeHtml(displayColumn(metric.column))} · ${escapeHtml(metric.label)}</strong>
        <span>${escapeHtml(fmt(analyst))}</span>
        <span>${escapeHtml(fmt(external))}</span>
        <span>${escapeHtml(fmt(ai))}</span>
        <span>${escapeHtml(fmt(blended))}</span>
        <span class="${spread >= 2 ? 'is-alert-text' : ''}">${escapeHtml(fmt(spread))}</span>
      </div>
    `;
  }).join('');
  const noteBlocks = visibleTableMetrics().map((metric) => {
    const score = scoringCore.resolveMetricScore(candidate, metric.column);
    const note = String(candidate.notes?.[metric.column] || '').trim();
    return `
      <div class="startup-note-card">
        <div class="startup-note-head">
          <strong>${escapeHtml(displayColumn(metric.column))} · ${escapeHtml(metric.label)}</strong>
          <span class="muted">Score ${escapeHtml(fmt(score))} · Weight ${escapeHtml(fmt(metric.weight, 0))}</span>
        </div>
        <p>${escapeHtml(note || 'No analyst note entered for this metric yet.')}</p>
      </div>
    `;
  }).join('');

  els.tableDetailPanel.className = 'startup-detail-grid';
  els.tableDetailPanel.innerHTML = `
    <div class="startup-detail-overview">
      <div class="selected-brief-heading">
        <div>
          <h4>${escapeHtml(candidate.name)}</h4>
          <p>${escapeHtml(stage)} · ${escapeHtml(quadrantOf(candidate))}</p>
        </div>
        <div class="selected-brief-chips">
          ${tags.length ? tags.map((tag) => `<span class="brief-chip">${escapeHtml(tag)}</span>`).join('') : '<span class="brief-chip is-muted">No tags</span>'}
        </div>
      </div>
      <div class="selected-brief-kpis">
        <div class="kpi"><div class="muted">Total</div><strong>${escapeHtml(fmt(candidate.computed.total))}</strong></div>
        <div class="kpi"><div class="muted">Non-Fin</div><strong>${escapeHtml(fmt(candidate.computed.nonFinancial))}</strong></div>
        <div class="kpi"><div class="muted">Fin</div><strong>${escapeHtml(fmt(candidate.computed.financial))}</strong></div>
        <div class="kpi"><div class="muted">Coverage</div><strong>${escapeHtml(fmt(quality.coverage * 100, 0))}%</strong></div>
      </div>
      <div class="decision-summary startup-detail-summary">
        <div class="decision-item"><strong>Notes coverage</strong><span>${escapeHtml(String(notes.filled))}/${escapeHtml(String(notes.total))} metrics documented</span></div>
        <div class="decision-item"><strong>Top weighted drivers</strong><span>${escapeHtml(topDrivers.length ? topDrivers.map((metric) => metric.label).join(' · ') : 'No weighted drivers yet')}</span></div>
        <div class="decision-item"><strong>Fastest improvement areas</strong><span>${escapeHtml(topGaps.length ? topGaps.map((metric) => metric.label).join(' · ') : 'Already at max visible score')}</span></div>
        <div class="decision-item"><strong>AI confidence</strong><span>${signalSummary.confidence !== null && signalSummary.confidence !== undefined ? `${escapeHtml(fmt(signalSummary.confidence * 100, 0))}%` : 'Not evaluated yet'}</span></div>
        <div class="decision-item"><strong>Highest score disagreements</strong><span>${escapeHtml(signalSummary.disagreements.metrics.length ? signalSummary.disagreements.metrics.map((metric) => `${displayColumn(metric.column)} ${metric.label}`).join(' · ') : 'No major disagreement')}</span></div>
        <div class="decision-item"><strong>Latest AI summary</strong><span>${escapeHtml(signalSummary.summary)}</span></div>
      </div>
      <div class="startup-detail-actions">
        <label>Move stage
          <select id="tableDetailStageSelect">
            <option value="sourcing"${stage === 'sourcing' ? ' selected' : ''}>sourcing</option>
            <option value="diligence"${stage === 'diligence' ? ' selected' : ''}>diligence</option>
            <option value="ic-ready"${stage === 'ic-ready' ? ' selected' : ''}>ic-ready</option>
            <option value="watchlist"${stage === 'watchlist' ? ' selected' : ''}>watchlist</option>
            <option value="pass"${stage === 'pass' ? ' selected' : ''}>pass</option>
          </select>
        </label>
        <button id="tableDetailApplyStageBtn" type="button">Update Stage</button>
      </div>
    </div>
    <div class="startup-detail-notes">
      <h4>Decision Signals</h4>
      <div class="startup-signal-grid">
        <div class="startup-signal-card">
          <strong>Strengths</strong>
          <p>${escapeHtml(signalSummary.strengths.length ? signalSummary.strengths.join(' · ') : 'No AI strengths available yet.')}</p>
        </div>
        <div class="startup-signal-card">
          <strong>Risks</strong>
          <p>${escapeHtml(signalSummary.risks.length ? signalSummary.risks.join(' · ') : 'No AI risks available yet.')}</p>
        </div>
      </div>
      <h4>Evaluation Matrix</h4>
      <div class="evaluation-matrix">
        <div class="evaluation-matrix-row evaluation-matrix-head">
          <strong>Metric</strong>
          <span>Analyst</span>
          <span>External</span>
          <span>AI</span>
          <span>Blended</span>
          <span>Spread</span>
        </div>
        ${evaluationMatrix}
      </div>
      <h4>Metric Notes</h4>
      <div class="startup-note-list">${noteBlocks}</div>
    </div>
  `;
}

function renderWeights() {
  const wrap = els.weightsContainer;
  wrap.innerHTML = '';
  els.presetSelect.value = state.weightPreset;
  const movers = previewRankChanges();
  const changed = draftWeightsChanged();
  const visibleWeightMetrics = getMetrics().filter((metric) => !['J', 'K', 'L'].includes(metric.column));

  visibleWeightMetrics.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'weight-row';

    const label = document.createElement('div');
    const live = Number(m.weight) || 0;
    const draft = Number(state.draftWeights[m.column] ?? live);
    label.innerHTML = `
      <strong>${escapeHtml(displayColumn(m.column))} · ${escapeHtml(m.label)}</strong>
      <span class="muted">Live ${escapeHtml(fmt(live, 0))} → Draft ${escapeHtml(fmt(draft, 0))}</span>
    `;

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.1';
    inp.min = '0';
    inp.value = draft;
    inp.dataset.column = m.column;
    inp.dataset.action = 'draft-weight';

    row.append(label, inp);
    wrap.appendChild(row);
  });

  els.weightPreviewSummary.innerHTML = '';
  const summary = document.createElement('div');
  summary.className = 'preview-summary-card';
  summary.innerHTML = `
    <div class="decision-item">
      <strong>Draft status</strong>
      <span>${changed ? 'Pending changes' : 'No pending changes'}</span>
    </div>
    <div class="decision-item">
      <strong>Preset</strong>
      <span>${escapeHtml(state.weightPreset)}</span>
    </div>
    <div class="decision-item">
      <strong>Impact</strong>
      <span>${movers.length ? `${movers.length} ranked movers` : 'No rank movement'}</span>
    </div>
  `;
  els.weightPreviewSummary.appendChild(summary);

  const impact = document.createElement('div');
  impact.className = 'impact-list';
  if (!movers.length) {
    impact.innerHTML = '<p class="muted">Applying this draft does not change current ranking order.</p>';
  } else {
    movers.forEach((mover) => {
      const item = document.createElement('div');
      item.className = 'impact-item';
      item.innerHTML = `
        <strong>${escapeHtml(mover.name)}</strong>
        <span>${escapeHtml(`#${mover.before} → #${mover.after}`)} · ${escapeHtml(mover.totalDelta >= 0 ? '+' : '')}${escapeHtml(fmt(mover.totalDelta))} total</span>
      `;
      impact.appendChild(item);
    });
  }
  els.weightPreviewSummary.appendChild(impact);

  const rubrics = getRubrics().filter((rubric) => !['J', 'K', 'L'].includes(rubric.column));
  const current = els.rubricMetric.value || rubrics[0]?.column;
  els.rubricMetric.innerHTML = '';
  rubrics.forEach((r) => {
    const o = document.createElement('option');
    o.value = r.column;
    o.textContent = `${displayColumn(r.column)} · ${r.label}`;
    els.rubricMetric.appendChild(o);
  });
  if ([...els.rubricMetric.options].some((o) => o.value === current)) els.rubricMetric.value = current;
  const r = rubrics.find((x) => x.column === els.rubricMetric.value);
  els.rubricText.textContent = r?.rubric || 'No rubric available.';
}

function renderControls() {
  setPane(state.activePane);

  els.scatterControls.hidden = !state.scatterControlsOpen;
  els.scatterControls.setAttribute('aria-hidden', String(!state.scatterControlsOpen));
  els.toggleScatterControls.textContent = state.scatterControlsOpen ? 'Hide Controls' : 'Scatter Controls';
  els.toggleScatterControls.setAttribute('aria-expanded', String(state.scatterControlsOpen));
  els.nfInput.value = Number(state.thresholds.nf ?? 0);
  els.fInput.value = Number(state.thresholds.f ?? 0);
  if (els.focusTopNearToggle) els.focusTopNearToggle.checked = state.scatterFocusTopNear;
  els.labelMode.value = state.labelMode;

  els.searchInput.value = state.search;
  els.sortSelect.value = state.sort;
  els.quadrantSelect.value = state.quadrant;
  els.savedViewSelect.value = state.savedView;
  els.presetSelect.value = state.weightPreset;
}

function renderAll() {
  renderControls();
  renderScatter();
  renderAnalysisPanels();
  renderCompare();
  renderNewForm();
  renderTable();
  renderWeights();
}

function attachEvents() {
  els.navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activePane = btn.dataset.pane;
      save();
      renderAll();
    });
  });

  els.toggleScatterControls.addEventListener('click', () => {
    state.scatterControlsOpen = !state.scatterControlsOpen;
    save();
    renderControls();
  });

  els.nfInput.addEventListener('input', () => {
    state.thresholds.nf = num(els.nfInput.value) ?? 0;
    save();
    renderAll();
    scheduleAnalyticsRefresh();
  });
  els.fInput.addEventListener('input', () => {
    state.thresholds.f = num(els.fInput.value) ?? 0;
    save();
    renderAll();
    scheduleAnalyticsRefresh();
  });

  els.useAvg.addEventListener('click', () => {
    state.thresholds.nf = Math.round(scoringCore.average(state.candidates.map((c) => c.computed.nonFinancial)));
    state.thresholds.f = Math.round(scoringCore.average(state.candidates.map((c) => c.computed.financial)));
    save();
    renderAll();
    scheduleAnalyticsRefresh();
  });

  els.useMedian.addEventListener('click', () => {
    state.thresholds.nf = Math.round(scoringCore.median(state.candidates.map((c) => c.computed.nonFinancial)));
    state.thresholds.f = Math.round(scoringCore.median(state.candidates.map((c) => c.computed.financial)));
    save();
    renderAll();
    scheduleAnalyticsRefresh();
  });

  els.focusTopNearToggle?.addEventListener('change', () => {
    state.scatterFocusTopNear = els.focusTopNearToggle.checked;
    save();
    renderScatter();
  });

  els.labelMode.addEventListener('change', () => {
    state.labelMode = els.labelMode.value;
    save();
    renderScatter();
  });

  els.scatterCanvas.addEventListener('mousemove', (event) => {
    const pos = canvasPosFromEvent(els.scatterCanvas, event);
    const nearest = findNearestScatterPoint(pos.x, pos.y);
    const nextId = nearest?.id || null;
    if (nextId !== state.scatterHoverId) {
      state.scatterHoverId = nextId;
      renderScatter();
    }
    if (nearest) {
      els.scatterCanvas.style.cursor = 'pointer';
      showScatterTooltip(nearest, pos.clientX, pos.clientY);
    } else {
      els.scatterCanvas.style.cursor = 'crosshair';
      hideScatterTooltip();
    }
  });

  els.scatterCanvas.addEventListener('mouseleave', () => {
    state.scatterHoverId = null;
    els.scatterCanvas.style.cursor = 'default';
    hideScatterTooltip();
    renderScatter();
  });

  els.scatterCanvas.addEventListener('click', (event) => {
    const pos = canvasPosFromEvent(els.scatterCanvas, event);
    const nearest = findNearestScatterPoint(pos.x, pos.y);
    if (!nearest) return;
    state.scatterSelectedId = state.scatterSelectedId === nearest.id ? null : nearest.id;
    state.aiSelectedStartupId = state.scatterSelectedId || state.aiSelectedStartupId;
    renderScatter();
    renderSelectedStartupBrief();
    renderAiWorkflow();
    save();
  });

  els.scatterCanvas.addEventListener('dblclick', (event) => {
    const pos = canvasPosFromEvent(els.scatterCanvas, event);
    const frame = state.scatterFrame;
    if (!frame) return;
    const { plot, xMax, yMax } = frame;
    if (pos.x < plot.x || pos.x > plot.x + plot.w || pos.y < plot.y || pos.y > plot.y + plot.h) return;
    const nf = ((pos.x - plot.x) / plot.w) * xMax;
    const f = ((plot.y + plot.h - pos.y) / plot.h) * yMax;
    state.thresholds.nf = Math.max(0, Math.round(nf));
    state.thresholds.f = Math.max(0, Math.round(f));
    save();
    renderAll();
    scheduleAnalyticsRefresh();
  });

  els.compareA.addEventListener('change', () => {
    state.compareA = els.compareA.value;
    if (state.compareB === state.compareA) state.compareB = state.candidates.find((c) => c.id !== state.compareA)?.id || state.compareA;
    save();
    renderCompare();
  });

  els.compareB.addEventListener('change', () => {
    state.compareB = els.compareB.value;
    if (state.compareB === state.compareA) state.compareA = state.candidates.find((c) => c.id !== state.compareB)?.id || state.compareB;
    save();
    renderCompare();
  });

  els.compareMode.addEventListener('change', () => {
    state.compareMode = els.compareMode.value;
    save();
    renderCompare();
  });

  els.aiStartupSelect?.addEventListener('change', () => {
    state.aiSelectedStartupId = els.aiStartupSelect.value || null;
    state.aiStatusText = '';
    save();
    renderAiWorkflow();
  });

  els.aiQueueBtn?.addEventListener('click', async () => {
    if (!state.serverMode || !state.aiSelectedStartupId) return;
    state.aiBusy = true;
    renderAiWorkflow();
    try {
      await apiJson(EVALUATION_JOBS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startupId: state.aiSelectedStartupId,
          requestedBy: 'frontend-ui',
          payload: { trigger: 'manual-queue' },
        }),
      });
      await refreshEvaluationWorkflow();
      state.aiStatusText = 'Evaluation job queued successfully.';
    } catch (error) {
      console.error(error);
      state.aiStatusText = error.message;
    } finally {
      state.aiBusy = false;
      renderAiWorkflow();
    }
  });

  els.aiProcessNextBtn?.addEventListener('click', async () => {
    if (!state.serverMode) return;
    state.aiBusy = true;
    renderAiWorkflow();
    try {
      const result = await apiJson(`${EVALUATION_JOBS_URL}/process-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (result?.startup?.id) {
        const current = getCandidateById(result.startup.id);
        if (current) Object.assign(current, result.startup);
        recomputeAll();
      }
      await refreshEvaluationWorkflow();
      await refreshAnalytics({ render: false });
      if (result?.evaluation?.startupId) {
        state.aiSelectedStartupId = result.evaluation.startupId;
        state.aiStatusText = `Processed evaluation job for ${getCandidateById(result.evaluation.startupId)?.name || result.evaluation.startupId}.`;
      } else {
        state.aiStatusText = 'No queued evaluation job was available.';
      }
    } catch (error) {
      console.error(error);
      state.aiStatusText = error.message;
    } finally {
      state.aiBusy = false;
      renderAll();
    }
  });

  els.aiRefreshBtn?.addEventListener('click', async () => {
    state.aiBusy = true;
    renderAiWorkflow();
    try {
      await refreshRemoteDerivedData();
      state.aiStatusText = 'Analytics and AI workflow refreshed.';
    } catch (error) {
      console.error(error);
      state.aiStatusText = error.message;
    } finally {
      state.aiBusy = false;
      renderAiWorkflow();
    }
  });

  els.swapBtn.addEventListener('click', () => {
    const a = state.compareA;
    state.compareA = state.compareB;
    state.compareB = a;
    save();
    renderCompare();
  });

  els.briefCompareBtn?.addEventListener('click', () => {
    const selected = getCandidateById(state.scatterSelectedId);
    if (!selected) return;
    const benchmark = topCandidateExcluding(selected.id);
    state.compareA = selected.id;
    state.compareB = benchmark?.id || state.compareB || selected.id;
    state.activePane = 'compare';
    save();
    renderAll();
  });

  els.briefPipelineBtn?.addEventListener('click', () => {
    const selected = getCandidateById(state.scatterSelectedId);
    if (!selected) return;
    state.search = selected.name;
    state.activePane = 'table';
    save();
    renderAll();
  });

  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value;
    save();
    renderTable();
    renderScatter();
  });

  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    save();
    renderTable();
    renderScatter();
    renderAnalysisPanels();
  });

  els.quadrantSelect.addEventListener('change', () => {
    state.quadrant = els.quadrantSelect.value;
    save();
    renderTable();
    renderScatter();
    renderAnalysisPanels();
  });

  els.savedViewSelect.addEventListener('change', () => {
    state.savedView = els.savedViewSelect.value;
    state.selectedRows = [];
    save();
    renderTable();
    renderScatter();
    renderAnalysisPanels();
  });

  els.selectVisibleToggle.addEventListener('change', () => {
    const rows = visibleCandidates();
    if (els.selectVisibleToggle.checked) state.selectedRows = rows.map((row) => row.id);
    else state.selectedRows = [];
    save();
    renderTable();
  });

  els.bulkTagBtn.addEventListener('click', async () => {
    const tags = normalizeTagList(els.bulkTagInput.value);
    if (state.serverMode) {
      try {
        await Promise.all(state.selectedRows.map((id) => {
          const candidate = getCandidateById(id);
          const merged = [...new Set([...(candidate ? candidateTags(candidate) : []), ...tags])];
          return updateStartupRemote(id, { tags: merged });
        }));
      } catch (error) {
        alert(error.message);
        return;
      }
    }
    applyTagToSelected(tags);
    els.bulkTagInput.value = '';
    save();
    renderTable();
  });

  els.bulkStageBtn.addEventListener('click', async () => {
    const nextStage = els.bulkStageSelect.value;
    if (state.serverMode) {
      try {
        await Promise.all(state.selectedRows.map((id) => updateStartupRemote(id, { stage: nextStage })));
      } catch (error) {
        alert(error.message);
        return;
      }
    }
    applyStageToSelected(nextStage);
    els.bulkStageSelect.value = '';
    save();
    renderTable();
  });

  els.bulkDeleteBtn.addEventListener('click', async () => {
    if (state.serverMode) {
      try {
        await Promise.all(state.selectedRows.map((id) => apiJson(`${STARTUPS_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' })));
      } catch (error) {
        alert(error.message);
        return;
      }
    }
    deleteSelectedRows();
    save();
    renderAll();
    refreshRemoteDerivedData({ workflow: true }).catch(console.error);
  });

  els.table.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('input, select, button, textarea, label')) return;
    const row = target.closest('tr[data-id]');
    if (!row) return;
    state.selectedTableStartupId = row.dataset.id;
    save();
    renderTable();
  });

  els.table.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest('tr[data-id]');
    if (!row) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (target.closest('input, select, button, textarea')) return;
    event.preventDefault();
    state.selectedTableStartupId = row.dataset.id;
    save();
    renderTable();
  });

  els.table.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === 'tableSelectAll' && target instanceof HTMLInputElement) {
      const rows = visibleCandidates();
      state.selectedRows = target.checked ? rows.map((row) => row.id) : [];
      save();
      renderTable();
      return;
    }

    if (target.dataset.action === 'toggle-select' && target instanceof HTMLInputElement) {
      const set = selectedRowSet();
      if (target.checked) set.add(target.dataset.id);
      else set.delete(target.dataset.id);
      state.selectedRows = [...set];
      save();
      renderTable();
      return;
    }

    if (target.dataset.action === 'edit-stage' && target instanceof HTMLSelectElement) {
      const candidate = getCandidateById(target.dataset.id);
      if (!candidate) return;
      if (state.serverMode) {
        updateStartupRemote(target.dataset.id, { stage: target.value })
          .then((saved) => {
            Object.assign(candidate, saved);
            save();
            renderTable();
          })
          .catch((error) => {
            alert(error.message);
            target.value = candidateStage(candidate);
          });
        return;
      }
      candidate.stage = target.value;
      save();
      renderTable();
    }
  });

  els.tableDetailCompareBtn?.addEventListener('click', () => {
    const candidate = getCandidateById(state.selectedTableStartupId);
    if (!candidate) return;
    const benchmark = topCandidateExcluding(candidate.id);
    state.compareA = candidate.id;
    state.compareB = benchmark?.id || state.compareB || candidate.id;
    state.activePane = 'compare';
    save();
    renderAll();
  });

  els.tableDetailQueueBtn?.addEventListener('click', async () => {
    const candidate = getCandidateById(state.selectedTableStartupId);
    if (!candidate || !state.serverMode) return;
    try {
      await apiJson(EVALUATION_JOBS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startupId: candidate.id,
          requestedBy: 'table-detail',
          payload: { trigger: 'pipeline-detail' },
        }),
      });
      state.aiSelectedStartupId = candidate.id;
      state.aiStatusText = `Evaluation job queued for ${candidate.name}.`;
      await refreshEvaluationWorkflow({ render: false });
      renderTableDetail();
      renderAiWorkflow();
    } catch (error) {
      alert(error.message);
    }
  });

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === 'analysis-open-pipeline') {
      const candidate = getCandidateById(target.dataset.id);
      if (!candidate) return;
      state.selectedTableStartupId = candidate.id;
      state.search = candidate.name;
      state.activePane = 'table';
      save();
      renderAll();
      return;
    }
    if (target.dataset.action === 'analysis-compare-top') {
      const candidate = getCandidateById(target.dataset.id);
      if (!candidate) return;
      const benchmark = topCandidateExcluding(candidate.id);
      state.compareA = candidate.id;
      state.compareB = benchmark?.id || state.compareB || candidate.id;
      state.activePane = 'compare';
      save();
      renderAll();
      return;
    }
    if (target.dataset.action === 'analysis-queue-ai') {
      const candidate = getCandidateById(target.dataset.id);
      if (!candidate || !state.serverMode) return;
      try {
        await apiJson(EVALUATION_JOBS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startupId: candidate.id,
            requestedBy: 'analysis-triage',
            payload: { trigger: 'triage-board' },
          }),
        });
        state.aiSelectedStartupId = candidate.id;
        state.aiStatusText = `Evaluation job queued for ${candidate.name}.`;
        await refreshEvaluationWorkflow({ render: false });
        renderAnalysisPanels();
      } catch (error) {
        alert(error.message);
      }
      return;
    }
    if (target.id !== 'tableDetailApplyStageBtn') return;
    const candidate = getCandidateById(state.selectedTableStartupId);
    const select = document.getElementById('tableDetailStageSelect');
    if (!candidate || !(select instanceof HTMLSelectElement)) return;
    try {
      if (state.serverMode) {
        const saved = await updateStartupRemote(candidate.id, { stage: select.value });
        Object.assign(candidate, saved);
      } else {
        candidate.stage = select.value;
      }
      save();
      renderTable();
    } catch (error) {
      alert(error.message);
    }
  });

  els.table.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === 'edit-tags' && target instanceof HTMLInputElement) {
      const candidate = getCandidateById(target.dataset.id);
      if (!candidate) return;
      const nextTags = normalizeTagList(target.value);
      if (state.serverMode) {
        updateStartupRemote(target.dataset.id, { tags: nextTags })
          .then((saved) => {
            Object.assign(candidate, saved);
            save();
            renderTable();
          })
          .catch((error) => {
            alert(error.message);
            target.value = candidateTags(candidate).join(', ');
          });
        return;
      }
      candidate.tags = nextTags;
      save();
    }
  });

  els.aiMetricSlots?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.dataset.action !== 'external-score') return;
    const candidate = getCandidateById(target.dataset.id);
    if (!candidate) return;
    const previousScores = clone(candidate.externalScores || {});
    const nextValue = num(target.value);
    candidate.externalScores = {
      ...(candidate.externalScores || {}),
      [target.dataset.column]: nextValue,
    };

    const persist = async () => {
      if (!state.serverMode) return candidate;
      const saved = await updateStartupRemote(candidate.id, {
        externalScores: candidate.externalScores,
      });
      Object.assign(candidate, saved);
      return candidate;
    };

    persist()
      .then(() => {
        recomputeAll();
        save();
        renderAll();
        refreshAnalytics({ render: false }).then(() => renderAnalysisPanels()).catch(console.error);
      })
      .catch((error) => {
        candidate.externalScores = previousScores;
        alert(error.message);
        recomputeAll();
        renderAll();
      });
  });

  els.applyPresetBtn.addEventListener('click', () => {
    loadWeightPreset(els.presetSelect.value);
    refreshWeightPreview();
  });

  els.resetDraftWeightsBtn.addEventListener('click', () => {
    setDraftWeightsFromModel();
    state.weightPreset = 'balanced';
    refreshWeightPreview();
  });

  els.applyWeightsBtn.addEventListener('click', async () => {
    if (state.serverMode) {
      try {
        const result = await apiJson(WEIGHTS_APPLY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.draftWeights),
        });
        if (Array.isArray(result.weights)) {
          state.model.weights = result.weights;
        }
      } catch (error) {
        alert(error.message);
        return;
      }
    } else {
      getMetrics().forEach((metric) => {
        metric.weight = Number(state.draftWeights[metric.column] ?? metric.weight) || 0;
      });
    }
    recomputeAll();
    setDraftWeightsFromModel();
    state.weightPreviewData = null;
    save();
    renderAll();
    refreshRemoteDerivedData({ workflow: false }).catch(console.error);
  });

  els.weightsContainer.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action !== 'draft-weight') return;
    state.draftWeights[target.dataset.column] = num(target.value) ?? 0;
    refreshWeightPreview();
  });

  els.rubricMetric.addEventListener('change', () => {
    const r = getRubrics().find((x) => x.column === els.rubricMetric.value);
    els.rubricText.textContent = r?.rubric || 'No rubric available.';
  });

  els.guideMetric.addEventListener('change', renderGuide);

  const rebuildDraft = () => {
    syncNewDraftMetaFromInputs();
    buildDraftFromSelections();
    renderNewForm();
    markNewDraftSaved(state.serverMode ? 'Draft prefilled and saved to server.' : 'Draft prefilled and saved locally.').catch(console.error);
    setFeedback('Draft prefilled.', 'neutral');
  };
  els.newDraftPicker?.addEventListener('change', () => {
    els.loadDraftBtn.disabled = !els.newDraftPicker.value;
    els.deleteDraftBtn.disabled = !(state.newDraftMeta.draftId || els.newDraftPicker.value);
  });
  els.loadDraftBtn?.addEventListener('click', () => {
    const draftId = els.newDraftPicker.value;
    if (!draftId) return;
    const draft = state.newStartupDrafts.find((entry) => entry?.meta?.draftId === draftId);
    if (!draft) return;
    activateNewStartupDraft(draft);
    renderNewForm();
    saveUi();
    setFeedback(`Loaded draft "${state.newDraftMeta.name || 'Untitled draft'}".`, 'neutral');
  });
  els.newDraftBtn?.addEventListener('click', () => {
    startFreshNewDraft();
    renderNewForm();
    saveUi();
    setFeedback('Started a new draft.', 'neutral');
  });
  els.deleteDraftBtn?.addEventListener('click', async () => {
    const draftId = state.newDraftMeta.draftId || els.newDraftPicker.value;
    if (!draftId) return;
    const deletingActive = draftId === state.newDraftMeta.draftId;
    state.newStartupDrafts = state.newStartupDrafts.filter((draft) => draft?.meta?.draftId !== draftId);
    if (deletingActive) {
      state.newDraft = null;
      resetNewDraftMeta();
      buildDraftFromSelections();
    }
    saveUi();
    renderNewForm();
    setFeedback('Draft deleted.', 'success');
    if (!state.serverMode) return;
    try {
      await apiJson(`${DRAFTS_URL}/${encodeURIComponent(newStartupDraftKey(draftId))}`, { method: 'DELETE' });
      await refreshNewStartupDraftLibrary();
      renderNewDraftPicker();
    } catch (error) {
      console.error(error);
      setFeedback('Draft removed locally, but server delete failed.', 'error');
    }
  });
  els.prefillBtn.addEventListener('click', rebuildDraft);
  els.newTemplate.addEventListener('change', rebuildDraft);
  els.newClone.addEventListener('change', rebuildDraft);
  els.newNotesMode.addEventListener('change', rebuildDraft);
  els.newName.addEventListener('input', () => {
    syncNewDraftMetaFromInputs();
    scheduleNewDraftPersist();
    renderNewDraftStatus();
  });

  els.saveDraftBtn.addEventListener('click', () => {
    syncNewDraftMetaFromInputs();
    if (!state.newDraft) buildDraftFromSelections();
    markNewDraftSaved(state.serverMode ? 'Draft saved to server.' : 'Draft saved locally.').catch(console.error);
    setFeedback('Draft saved. You can continue later before creating the startup.', 'success');
  });

  els.clearBtn.addEventListener('click', () => {
    const currentDraftId = state.newDraftMeta.draftId || '';
    els.newName.value = '';
    els.newTemplate.value = 'balanced';
    els.newClone.value = '';
    els.newNotesMode.value = 'empty';
    resetNewDraftMeta();
    state.newDraftMeta.draftId = currentDraftId;
    buildDraftFromSelections();
    renderNewForm();
    markNewDraftSaved(state.serverMode ? 'Draft reset and saved to server.' : 'Draft reset and saved locally.').catch(console.error);
    setFeedback('', 'neutral');
  });

  els.createBtn.addEventListener('click', async () => {
    const name = uniqueName(els.newName.value);
    if (!name) {
      setFeedback('Startup name is required.', 'error');
      els.newName.focus();
      return;
    }

    const v = validateDraft();
    if (!v.ok) {
      setFeedback(v.message, 'error');
      focusDraftField(v.metric, v.role);
      return;
    }

    const candidate = {
      id: uid(),
      sourceIndex: null,
      name,
      normalizedName: '',
      scores: clone(state.newDraft.scores),
      externalScores: clone(state.newDraft.externalScores),
      aiScores: clone(state.newDraft.aiScores),
      aiRationales: {},
      notes: Object.fromEntries(Object.entries(state.newDraft.notes).map(([k, vv]) => [k, (vv || '').trim()])),
      computedFromExcel: null,
      isNew: true,
      computed: { nonFinancial: 0, financial: 0, total: 0 },
      tags: [],
      stage: 'sourcing',
      lastAiEvaluationId: null,
    };

    if (state.serverMode) {
      try {
        const saved = await apiJson(STARTUPS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidate),
        });
        state.candidates.unshift({ ...saved, computed: { nonFinancial: 0, financial: 0, total: 0 } });
        state.aiSelectedStartupId = saved.id;
      } catch (error) {
        setFeedback(error.message, 'error');
        return;
      }
    } else {
      state.candidates.unshift(candidate);
      state.aiSelectedStartupId = candidate.id;
    }
    recomputeAll();
    ensureCompareSelection();
    const draftIdToClear = state.newDraftMeta.draftId || '';
    state.newDraft = null;
    resetNewDraftMeta();
    await clearPersistedNewStartupDraft('Draft cleared after startup creation.', draftIdToClear);
    state.activePane = 'table';
    save();
    renderAll();
    setFeedback(`Created "${name}".`, 'success');
    refreshRemoteDerivedData({ workflow: true }).catch(console.error);
  });

  els.newName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.createBtn.click();
    }
  });

  els.resetBtn.addEventListener('click', () => {
    if (!state.serverMode) {
      hydrate(freshSnapshot());
      localStorage.removeItem(STORAGE_KEY);
      state.newDraft = null;
      resetNewDraftMeta();
      saveUi();
      renderAll();
      refreshRemoteDerivedData().catch(console.error);
      return;
    }
    fetch(RESET_URL, { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
        return res.json();
      })
      .then((snapshot) => {
        localStorage.removeItem(STORAGE_KEY);
        hydrate({ ...snapshot, ui: {} });
        state.newDraft = null;
        resetNewDraftMeta();
        renderAll();
        refreshRemoteDerivedData().catch(console.error);
      })
      .catch((error) => {
        alert(error.message);
      });
  });

  els.exportBtn.addEventListener('click', () => {
    if (!state.serverMode) {
      const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vc-scouting-workbench-export.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    fetch(EXPORT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);
        return res.json();
      })
      .then((snapshot) => {
        const blob = new Blob([JSON.stringify({
          ...snapshot,
          ui: serializeUi(),
          newStartupDrafts: clone(state.newStartupDrafts || snapshot.newStartupDrafts || []),
          newStartupDraft: serializeNewStartupDraft(),
        }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vc-scouting-workbench-export.json';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        alert(error.message);
      });
  });

  els.importInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const snap = JSON.parse(text);
      if (!snap?.model || !Array.isArray(snap?.candidates)) throw new Error('Invalid JSON format');
      if (!state.serverMode) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ui: snap.ui || serializeUi(),
          newStartupDrafts: snap.newStartupDrafts || (snap.newStartupDraft ? [snap.newStartupDraft] : []),
          newStartupDraft: snap.newStartupDraft || null,
        }));
        hydrate({
          ...snap,
          newStartupDraft: snap.newStartupDraft || snap.newStartupDrafts?.[0] || null,
          newStartupDrafts: snap.newStartupDrafts || (snap.newStartupDraft ? [snap.newStartupDraft] : []),
        });
        renderAll();
        refreshRemoteDerivedData().catch(console.error);
        return;
      }
      const res = await fetch(IMPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snap),
      });
      if (!res.ok) throw new Error(`Import failed: ${res.status}`);
      const saved = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ui: snap.ui || serializeUi(),
        newStartupDrafts: snap.newStartupDrafts || (snap.newStartupDraft ? [snap.newStartupDraft] : []),
        newStartupDraft: snap.newStartupDraft || null,
      }));
      hydrate({
        ...saved,
        ui: snap.ui || serializeUi(),
        newStartupDraft: snap.newStartupDraft || snap.newStartupDrafts?.[0] || saved.newStartupDraft || null,
        newStartupDrafts: snap.newStartupDrafts || saved.newStartupDrafts || (snap.newStartupDraft ? [snap.newStartupDraft] : []),
      });
      renderAll();
      refreshRemoteDerivedData().catch(console.error);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  });

  window.addEventListener('resize', () => {
    renderScatter();
    renderCompare();
    renderAnalysisPanels();
  });
}

async function init() {
  try {
    const remote = await fetchBootstrapSnapshot();
    state.original = remote;
    const local = loadSaved();
    if (state.serverMode) {
      const remoteDrafts = Array.isArray(remote?.newStartupDrafts) ? remote.newStartupDrafts : [];
      const localDrafts = Array.isArray(local?.newStartupDrafts) ? local.newStartupDrafts : (local?.newStartupDraft ? [local.newStartupDraft] : []);
      const mergedDrafts = [...remoteDrafts];
      localDrafts.forEach((draft) => {
        const normalized = normalizeDraftLibraryEntry(draft);
        if (!normalized?.meta?.draftId) return;
        if (!mergedDrafts.some((entry) => normalizeDraftLibraryEntry(entry)?.meta?.draftId === normalized.meta.draftId)) {
          mergedDrafts.push(normalized);
        }
      });
      hydrate({
        ...remote,
        ui: local?.ui || {},
        newStartupDrafts: mergedDrafts,
        newStartupDraft: pickNewestDraft(remote?.newStartupDraft || null, local?.newStartupDraft || null),
      });
    }
    else {
      const merged = local?.model && Array.isArray(local?.candidates)
        ? local
        : { ...remote, ui: local?.ui || {} };
      hydrate(merged);
    }

    attachEvents();
    renderAll();
    refreshWeightPreview();
    refreshRemoteDerivedData().catch(console.error);
  } catch (err) {
    document.body.innerHTML = `<main style="padding:20px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif">Failed to initialize app: ${escapeHtml(err.message)}</main>`;
    console.error(err);
  }
}

init();
