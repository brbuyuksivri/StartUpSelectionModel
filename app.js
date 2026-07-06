const DATA_URL = '/api/bootstrap';
const FALLBACK_DATA_URL = './data/vc_scouting.json';
const EXPORT_URL = '/api/export';
const IMPORT_URL = '/api/import';
const RESET_URL = '/api/reset';
const SNAPSHOT_URL = '/api/snapshot';
const STARTUPS_URL = '/api/startups';
const WEIGHTS_PREVIEW_URL = '/api/weights/preview';
const STORAGE_KEY = 'vc-scouting-model-ui-v2';
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

  compareA: document.getElementById('compareA'),
  compareB: document.getElementById('compareB'),
  compareMode: document.getElementById('compareMode'),
  swapBtn: document.getElementById('swapBtn'),
  compareSummary: document.getElementById('compareSummary'),
  decisionSummary: document.getElementById('decisionSummary'),
  compareHeatmap: document.getElementById('compareHeatmap'),
  compareCanvas: document.getElementById('compareCanvas'),

  newName: document.getElementById('newName'),
  newTemplate: document.getElementById('newTemplate'),
  newClone: document.getElementById('newClone'),
  newNotesMode: document.getElementById('newNotesMode'),
  prefillBtn: document.getElementById('prefillBtn'),
  clearBtn: document.getElementById('clearBtn'),
  createBtn: document.getElementById('createBtn'),
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
      notes: clone(c.notes),
      computedFromExcel: clone(c.computedFromExcel),
      isNew: !!c.isNew,
      tags: clone(candidateTags(c)),
      stage: candidateStage(c),
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
  };
}

function saveUi() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ui: serializeUi() }));
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

function schedulePersist() {
  clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(() => {
    persistServerSnapshot();
  }, 180);
}

function save() {
  saveUi();
  if (state.serverMode) schedulePersist();
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${url} failed: ${res.status}`);
  return res.json();
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
  state.candidates = snapshot.candidates.map((c) => ({ ...c, computed: { nonFinancial: 0, financial: 0, total: 0 } }));

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
  state.selectedRows = [];
  state.weightPreviewData = null;

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
      notes: clone(c.notes || {}),
      computedFromExcel: clone(c.computedFromExcel || null),
      isNew: false,
      tags: [],
      stage: 'sourcing',
    })),
    ui: {},
  };
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
  const rows = [...visibleCandidates()].slice(0, 8);
  const vals = rows.map((r) => r.computed.total);
  const portfolioTotals = state.candidates.map((c) => c.computed.total);
  const med = scoringCore.median(portfolioTotals);
  const maxTotal = maxTotals();
  const target = maxTotal * 0.7;
  const cutoff = maxTotal * 0.82;
  drawBars(els.rankingCanvas, rows.map((r) => r.name), vals, '#2f6bff', {
    benchmarks: [
      { label: `Median ${fmt(med)}`, value: med, color: '#64748b' },
      { label: `Target ${fmt(target)}`, value: target, color: '#2563eb' },
      { label: `Partner cutoff ${fmt(cutoff)}`, value: cutoff, color: '#059669' },
    ],
  });
  if (els.insightPipelineQuality) {
    const aboveTarget = vals.filter((v) => v >= target).length;
    const aboveCutoff = vals.filter((v) => v >= cutoff).length;
    els.insightPipelineQuality.textContent = `${aboveTarget}/${rows.length} top startups are above target, and ${aboveCutoff}/${rows.length} exceed partner cutoff. Focus diligence on startups just below cutoff for fastest IC-ready growth.`;
  }
}

function renderDistribution() {
  const vals = state.candidates.map((c) => c.computed.total);
  if (!vals.length) return;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const bins = 8;
  const step = Math.max(1, (max - min) / bins);
  const counts = Array.from({ length: bins }, () => 0);
  vals.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx] += 1;
  });
  const labels = counts.map((_, i) => `${fmt(min + i * step, 0)}+`);
  const med = scoringCore.median(vals);
  const maxTotal = maxTotals();
  const target = maxTotal * 0.7;
  const cutoff = maxTotal * 0.82;
  drawBars(els.distCanvas, labels, counts, '#00a3a3', {
    benchmarks: [
      { label: 'Median bucket', value: counts[Math.min(bins - 1, Math.floor((med - min) / step))] || 0, color: '#64748b' },
      { label: 'Target bucket', value: counts[Math.min(bins - 1, Math.floor((target - min) / step))] || 0, color: '#2563eb' },
      { label: 'Cutoff bucket', value: counts[Math.min(bins - 1, Math.floor((cutoff - min) / step))] || 0, color: '#059669' },
    ],
  });
  if (els.insightRiskDispersion) {
    const high = vals.filter((v) => v >= cutoff).length;
    const low = vals.filter((v) => v < target).length;
    els.insightRiskDispersion.textContent = `${high} startups sit in the high-conviction band, while ${low} remain below target. Risk is concentrated in the lower tail; prioritize de-risking those with strong market signal.`;
  }
}

function renderQuadrantPieChart() {
  if (!els.quadrantPieCanvas) return;
  const { ctx, width: W, height: H } = prepareCanvas(els.quadrantPieCanvas);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const quadrants = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  const labels = ['Top-right', 'Top-left', 'Bottom-right', 'Bottom-left'];
  const colors = ['#00a3a3', '#2f6bff', '#13b981', '#94a3b8'];
  const values = quadrants.map((q) => state.candidates.filter((c) => quadrantOf(c) === q).length);
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
    const tr = values[0] || 0;
    const bl = values[3] || 0;
    const concentration = Math.round((tr / total) * 100);
    els.insightDealflowBalance.textContent = `Dealflow is ${concentration}% concentrated in Invest zone, with ${bl} startups in Pass zone. Balance is healthy if Watch zones stay fed by new high-upside candidates.`;
  }
}

function renderRankingContributionChart() {
  if (!els.rankingContributionCanvas) return;
  const { ctx, width: W, height: H } = prepareCanvas(els.rankingContributionCanvas);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const rows = [...state.candidates].sort((a, b) => b.computed.total - a.computed.total).slice(0, 10);
  if (!rows.length) return;
  const total = rows.reduce((s, r) => s + r.computed.total, 0) || 1;
  let cumulative = 0;
  const cumPct = rows.map((r) => {
    cumulative += r.computed.total;
    return (cumulative / total) * 100;
  });

  const pad = { l: 48, r: 22, t: 24, b: 72 };
  const plot = { x: pad.l, y: pad.t, w: W - pad.l - pad.r, h: H - pad.t - pad.b };
  const lane = plot.w / rows.length;
  const barW = Math.max(12, Math.min(34, lane - 10));
  const maxTotal = Math.max(...rows.map((r) => r.computed.total), 1);

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
    const h = (r.computed.total / maxTotal) * plot.h;
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
    const top3 = rows.slice(0, 3).reduce((s, r) => s + r.computed.total, 0);
    const shareTop3 = Math.round((top3 / total) * 100);
    els.insightConvictionConcentration.textContent = `Top 3 startups account for ${shareTop3}% of top-10 conviction score. This indicates ${shareTop3 > 45 ? 'high' : 'moderate'} concentration risk across your highest-ranked pipeline.`;
  }
}

function renderOpportunityChart() {
  if (!els.opportunityCanvas) return;
  const maxTotal = maxTotals();
  const rows = [...state.candidates]
    .map((c) => ({ ...c, gap: Math.max(0, maxTotal - c.computed.total) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);
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
    const avgGap = rows.length ? scoringCore.average(rows.map((r) => r.gap)) : 0;
    const best = rows[0];
    els.insightOpportunity.textContent = best
      ? `${best.name} has the largest weighted upside gap (${fmt(best.gap)} points). Closing even 30% of average gap (${fmt(avgGap * 0.3)}) can materially shift ranking outcomes.`
      : 'No opportunity gap data available.';
  }
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

  const winsA = compareMetrics.filter((m) => (num(a.scores[m.column]) ?? 0) > (num(b.scores[m.column]) ?? 0)).length;
  const winsB = compareMetrics.filter((m) => (num(b.scores[m.column]) ?? 0) > (num(a.scores[m.column]) ?? 0)).length;
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
    const wa = (num(a.scores[m.column]) ?? 0) * (Number(m.weight) || 0);
    const wb = (num(b.scores[m.column]) ?? 0) * (Number(m.weight) || 0);
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

  const metrics = compareMetrics;
  const labels = metrics.map((m) => ({
    short: displayColumn(m.column),
    name: m.label,
    column: m.column,
  }));
  const valsA = metrics.map((m) => {
    const s = num(a.scores[m.column]) ?? 0;
    return state.compareMode === 'weighted' ? s * (Number(m.weight) || 0) : s;
  });
  const valsB = metrics.map((m) => {
    const s = num(b.scores[m.column]) ?? 0;
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
  const cloneId = els.newClone.value;
  const cloneC = state.candidates.find((c) => c.id === cloneId) || null;
  const tScores = templateScores(els.newTemplate.value || 'balanced');

  getNewStartupMetrics().forEach((m) => {
    if (cloneC) {
      draft.scores[m.column] = num(cloneC.scores[m.column]) ?? tScores[m.column] ?? null;
      draft.notes[m.column] = (cloneC.notes?.[m.column] || '').trim();
    } else {
      draft.scores[m.column] = tScores[m.column] ?? null;
      draft.notes[m.column] = els.newNotesMode.value === 'rubric' ? `Evidence for ${m.label} (why 1-5?)` : '';
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
  metrics.forEach((m) => {
    const scoreFilled = num(draft.scores[m.column]) !== null;
    const noteFilled = Boolean((draft.notes[m.column] || '').trim());
    if (scoreFilled && noteFilled) done += 1;
  });
  return { done, total: metrics.length };
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

  const oldClone = els.newClone.value;
  els.newClone.innerHTML = '<option value="">None</option>';
  [...state.candidates].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    els.newClone.appendChild(o);
  });
  if ([...els.newClone.options].some((o) => o.value === oldClone)) els.newClone.value = oldClone;

  if (!state.newDraft) buildDraftFromSelections();

  els.newMetrics.innerHTML = '';
  const sections = getNewStartupSections();
  sections.forEach((section) => {
    const block = document.createElement('details');
    block.className = 'new-section';
    block.dataset.section = section.key;
    block.open = section.open;

    const comp = sectionCompletion(section.metrics, state.newDraft);
    const allDone = comp.done === comp.total && comp.total > 0;
    const summary = document.createElement('summary');
    summary.className = 'new-section-summary';
    summary.innerHTML = `
      <span class="new-section-title">${escapeHtml(section.title)}</span>
      <span class="new-section-status ${allDone ? 'is-done' : ''}">
        ${escapeHtml(String(comp.done))}/${escapeHtml(String(comp.total))} completed
      </span>
    `;
    block.appendChild(summary);

    section.metrics.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'metric-row';

      const head = document.createElement('div');
      head.className = 'metric-head';
      head.innerHTML = `<span>${escapeHtml(displayColumn(m.column))} · ${escapeHtml(m.label)}</span><span class="muted">Weight: ${escapeHtml(String(m.weight))}</span>`;

      const sl = document.createElement('label');
      sl.textContent = 'Score';
      const select = scoreSelect(state.newDraft.scores[m.column], (v) => { state.newDraft.scores[m.column] = v; });
      select.dataset.metric = m.column;
      select.dataset.role = 'score';
      sl.appendChild(select);

      const nl = document.createElement('label');
      nl.textContent = 'Explanation';
      const ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = 'Write evidence and rationale.';
      ta.value = state.newDraft.notes[m.column] || '';
      ta.dataset.metric = m.column;
      ta.dataset.role = 'note';
      ta.addEventListener('input', () => { state.newDraft.notes[m.column] = ta.value; });
      nl.appendChild(ta);

      row.append(head, sl, nl);
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
    if (s === null) return { ok: false, message: `Missing score for ${displayColumn(m.column)}.`, metric: m.column, role: 'score' };
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
    inp.addEventListener('input', () => {
      c.name = inp.value;
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
    });
    tdA.appendChild(rm);

    tr.append(tdCheck, tdRank, tdName, tdTags, tdStage, tdNF, tdF, tdT, tdQ, tdA);
    tbody.appendChild(tr);
  });

  const headerToggle = document.getElementById('tableSelectAll');
  if (headerToggle) headerToggle.checked = rows.length > 0 && selectedVisible === rows.length;
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
  renderRanking();
  renderDistribution();
  renderQuadrantPieChart();
  renderRankingContributionChart();
  renderOpportunityChart();
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
  });
  els.fInput.addEventListener('input', () => {
    state.thresholds.f = num(els.fInput.value) ?? 0;
    save();
    renderAll();
  });

  els.useAvg.addEventListener('click', () => {
    state.thresholds.nf = Math.round(scoringCore.average(state.candidates.map((c) => c.computed.nonFinancial)));
    state.thresholds.f = Math.round(scoringCore.average(state.candidates.map((c) => c.computed.financial)));
    save();
    renderAll();
  });

  els.useMedian.addEventListener('click', () => {
    state.thresholds.nf = Math.round(scoringCore.median(state.candidates.map((c) => c.computed.nonFinancial)));
    state.thresholds.f = Math.round(scoringCore.median(state.candidates.map((c) => c.computed.financial)));
    save();
    renderAll();
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
    renderScatter();
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

  els.swapBtn.addEventListener('click', () => {
    const a = state.compareA;
    state.compareA = state.compareB;
    state.compareB = a;
    save();
    renderCompare();
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
    renderRanking();
  });

  els.quadrantSelect.addEventListener('change', () => {
    state.quadrant = els.quadrantSelect.value;
    save();
    renderTable();
    renderScatter();
    renderRanking();
  });

  els.savedViewSelect.addEventListener('change', () => {
    state.savedView = els.savedViewSelect.value;
    state.selectedRows = [];
    save();
    renderTable();
    renderScatter();
    renderRanking();
    renderDistribution();
    renderQuadrantPieChart();
    renderRankingContributionChart();
    renderOpportunityChart();
  });

  els.selectVisibleToggle.addEventListener('change', () => {
    const rows = visibleCandidates();
    if (els.selectVisibleToggle.checked) state.selectedRows = rows.map((row) => row.id);
    else state.selectedRows = [];
    save();
    renderTable();
  });

  els.bulkTagBtn.addEventListener('click', () => {
    const tags = normalizeTagList(els.bulkTagInput.value);
    applyTagToSelected(tags);
    els.bulkTagInput.value = '';
    save();
    renderTable();
  });

  els.bulkStageBtn.addEventListener('click', () => {
    applyStageToSelected(els.bulkStageSelect.value);
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
      candidate.stage = target.value;
      save();
      renderTable();
    }
  });

  els.table.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === 'edit-tags' && target instanceof HTMLInputElement) {
      const candidate = getCandidateById(target.dataset.id);
      if (!candidate) return;
      candidate.tags = normalizeTagList(target.value);
      save();
    }
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

  els.applyWeightsBtn.addEventListener('click', () => {
    getMetrics().forEach((metric) => {
      metric.weight = Number(state.draftWeights[metric.column] ?? metric.weight) || 0;
    });
    recomputeAll();
    save();
    renderAll();
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
    buildDraftFromSelections();
    renderNewForm();
    setFeedback('Draft prefilled.', 'neutral');
  };
  els.prefillBtn.addEventListener('click', rebuildDraft);
  els.newTemplate.addEventListener('change', rebuildDraft);
  els.newClone.addEventListener('change', rebuildDraft);
  els.newNotesMode.addEventListener('change', rebuildDraft);

  els.clearBtn.addEventListener('click', () => {
    els.newName.value = '';
    els.newTemplate.value = 'balanced';
    els.newClone.value = '';
    els.newNotesMode.value = 'empty';
    buildDraftFromSelections();
    renderNewForm();
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
      notes: Object.fromEntries(Object.entries(state.newDraft.notes).map(([k, vv]) => [k, (vv || '').trim()])),
      computedFromExcel: null,
      isNew: true,
      computed: { nonFinancial: 0, financial: 0, total: 0 },
      tags: [],
      stage: 'sourcing',
    };

    if (state.serverMode) {
      try {
        const saved = await apiJson(STARTUPS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidate),
        });
        state.candidates.unshift({ ...saved, computed: { nonFinancial: 0, financial: 0, total: 0 } });
      } catch (error) {
        setFeedback(error.message, 'error');
        return;
      }
    } else {
      state.candidates.unshift(candidate);
    }
    recomputeAll();
    ensureCompareSelection();
    els.newName.value = '';
    els.newClone.value = candidate.id;
    buildDraftFromSelections();
    state.activePane = 'table';
    save();
    renderAll();
    setFeedback(`Created "${name}".`, 'success');
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
      saveUi();
      renderAll();
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
        renderAll();
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
        const blob = new Blob([JSON.stringify({ ...snapshot, ui: serializeUi() }, null, 2)], { type: 'application/json' });
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ui: snap.ui || serializeUi() }));
        hydrate(snap);
        state.newDraft = null;
        renderAll();
        return;
      }
      const res = await fetch(IMPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snap),
      });
      if (!res.ok) throw new Error(`Import failed: ${res.status}`);
      const saved = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ui: snap.ui || serializeUi() }));
      hydrate({ ...saved, ui: snap.ui || serializeUi() });
      state.newDraft = null;
      renderAll();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  });

  window.addEventListener('resize', () => {
    renderScatter();
    renderCompare();
    renderRanking();
    renderDistribution();
    renderQuadrantPieChart();
    renderRankingContributionChart();
    renderOpportunityChart();
  });
}

async function init() {
  try {
    const remote = await fetchBootstrapSnapshot();
    state.original = remote;
    const local = loadSaved();
    if (state.serverMode) hydrate({ ...remote, ui: local?.ui || {} });
    else {
      const merged = local?.model && Array.isArray(local?.candidates)
        ? local
        : { ...remote, ui: local?.ui || {} };
      hydrate(merged);
    }

    attachEvents();
    renderAll();
    refreshWeightPreview();
  } catch (err) {
    document.body.innerHTML = `<main style="padding:20px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif">Failed to initialize app: ${escapeHtml(err.message)}</main>`;
    console.error(err);
  }
}

init();
