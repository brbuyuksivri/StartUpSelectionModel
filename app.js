const DATA_URL = './data/vc_scouting.json';
const STORAGE_KEY = 'vc-scouting-model-v2';
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
  labelMode: document.getElementById('labelMode'),
  scatterCanvas: document.getElementById('scatterCanvas'),
  scatterLegend: document.getElementById('scatterLegend'),
  rankingCanvas: document.getElementById('rankingCanvas'),
  distCanvas: document.getElementById('distCanvas'),
  quadrantPieCanvas: document.getElementById('quadrantPieCanvas'),
  rankingContributionCanvas: document.getElementById('rankingContributionCanvas'),

  compareA: document.getElementById('compareA'),
  compareB: document.getElementById('compareB'),
  compareMode: document.getElementById('compareMode'),
  swapBtn: document.getElementById('swapBtn'),
  compareSummary: document.getElementById('compareSummary'),
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
  table: document.getElementById('table'),

  weightsContainer: document.getElementById('weightsContainer'),
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
  compareA: null,
  compareB: null,
  compareMode: 'raw',
  newDraft: null,
  scatterPoints: [],
  scatterHoverId: null,
  scatterSelectedId: null,
  scatterFrame: null,
  scatterTooltipEl: null,
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

function weightsMap() {
  return Object.fromEntries(getMetrics().map((m) => [m.column, Number(m.weight) || 0]));
}

function computeScores(candidate) {
  const w = weightsMap();
  const NF = ['B', 'C', 'D', 'E', 'F'];
  const F = ['G', 'H', 'I', 'J', 'K'];
  const sum = (cols) => cols.reduce((s, c) => s + (num(candidate.scores[c]) ?? 0) * (w[c] ?? 0), 0);
  const nonFinancial = sum(NF);
  const financial = sum(F);
  const intuition = (num(candidate.scores.L) ?? 0) * (w.L ?? 0);
  return {
    nonFinancial,
    financial,
    total: nonFinancial + financial + intuition,
  };
}

function recomputeAll() {
  state.candidates.forEach((c) => {
    c.computed = computeScores(c);
  });
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
  const w = weightsMap();
  const cols = getMetrics().map((m) => m.column);
  return cols.reduce((sum, c) => sum + 5 * (w[c] ?? 0), 0);
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
    })),
    ui: {
      activePane: state.activePane,
      scatterControlsOpen: state.scatterControlsOpen,
      thresholds: clone(state.thresholds),
      labelMode: state.labelMode,
      search: state.search,
      sort: state.sort,
      quadrant: state.quadrant,
      compareA: state.compareA,
      compareB: state.compareB,
      compareMode: state.compareMode,
      scatterSelectedId: state.scatterSelectedId,
    },
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
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
  state.compareA = ui.compareA || state.candidates[0]?.id || null;
  state.compareB = ui.compareB || state.candidates.find((c) => c.id !== state.compareA)?.id || state.compareA;
  state.compareMode = ui.compareMode || 'raw';
  state.scatterSelectedId = ui.scatterSelectedId || null;

  recomputeAll();
  if (state.thresholds.nf === null) state.thresholds.nf = Math.round(avg(state.candidates.map((c) => c.computed.nonFinancial)));
  if (state.thresholds.f === null) state.thresholds.f = Math.round(avg(state.candidates.map((c) => c.computed.financial)));
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
  const rows = visibleCandidates();
  const pad = { l: 64, r: 24, t: 24, b: 64 };
  const plot = { x: pad.l, y: pad.t, w: W - pad.l - pad.r, h: H - pad.t - pad.b };

  const maxNF = Math.max(1, ...state.candidates.map((c) => c.computed.nonFinancial), Number(state.thresholds.nf || 0));
  const maxF = Math.max(1, ...state.candidates.map((c) => c.computed.financial), Number(state.thresholds.f || 0));
  const xMax = Math.ceil(maxNF / 10) * 10;
  const yMax = Math.ceil(maxF / 10) * 10;
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

  const color = (q) => q === 'top-right' ? '#00a3a3' : q === 'top-left' ? '#2f6bff' : q === 'bottom-right' ? '#13b981' : '#94a3b8';

  state.scatterPoints = rows.map((c) => {
    const q = quadrantOf(c);
    return {
      id: c.id,
      candidate: c,
      x: toX(c.computed.nonFinancial),
      y: toY(c.computed.financial),
      quadrant: q,
    };
  });

  if (state.scatterHoverId && !getScatterPointById(state.scatterHoverId)) state.scatterHoverId = null;
  if (state.scatterSelectedId && !getScatterPointById(state.scatterSelectedId)) state.scatterSelectedId = null;

  const drawCircle = (p) => {
    if (p.id === state.scatterSelectedId) {
      ctx.fillStyle = 'rgba(47,107,255,0.15)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color(p.quadrant);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.id === state.scatterHoverId ? 8 : 6.5, 0, Math.PI * 2);
    ctx.fill();
    if (p.id === state.scatterHoverId || p.id === state.scatterSelectedId) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.id === state.scatterHoverId ? 9 : 8, 0, Math.PI * 2);
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
  els.scatterLegend.textContent = `Top-right ${counts['top-right']} · Top-left ${counts['top-left']} · Bottom-right ${counts['bottom-right']} · Bottom-left ${counts['bottom-left']}${hoverText}${pinText}`;
}

function drawBars(canvas, labels, values, color = '#2f6bff') {
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
  drawBars(els.rankingCanvas, rows.map((r) => r.name), rows.map((r) => r.computed.total), '#2f6bff');
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
  drawBars(els.distCanvas, labels, counts, '#00a3a3');
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

  const winsA = getMetrics().filter((m) => (num(a.scores[m.column]) ?? 0) > (num(b.scores[m.column]) ?? 0)).length;
  const winsB = getMetrics().filter((m) => (num(b.scores[m.column]) ?? 0) > (num(a.scores[m.column]) ?? 0)).length;
  const ties = getMetrics().length - winsA - winsB;
  const cards = [
    ['A Total', fmt(a.computed.total)],
    ['B Total', fmt(b.computed.total)],
    ['Delta', fmt(a.computed.total - b.computed.total)],
    ['NF Delta', fmt(a.computed.nonFinancial - b.computed.nonFinancial)],
    ['F Delta', fmt(a.computed.financial - b.computed.financial)],
    ['Wins', `${winsA}-${winsB} (${ties} ties)`],
  ];
  els.compareSummary.innerHTML = cards.map(([k, v]) => `<div class="kpi"><div class="muted">${escapeHtml(k)}</div><strong>${escapeHtml(String(v))}</strong></div>`).join('');

  const metrics = getMetrics();
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

  getMetrics().forEach((m) => {
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
  getMetrics().forEach((m) => {
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
    els.newMetrics.appendChild(row);
  });

  const rubrics = getRubrics();
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
  for (const m of getMetrics()) {
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

function renderTable() {
  const rows = visibleCandidates();
  const thead = els.table.querySelector('thead');
  const tbody = els.table.querySelector('tbody');

  thead.innerHTML = '<tr><th>Rank</th><th>Name</th><th>Non-Fin</th><th>Fin</th><th>Total</th><th>Quadrant</th><th>Actions</th></tr>';
  tbody.innerHTML = '';

  rows.forEach((c, i) => {
    const tr = document.createElement('tr');

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

    const tdNF = document.createElement('td'); tdNF.textContent = fmt(c.computed.nonFinancial);
    const tdF = document.createElement('td'); tdF.textContent = fmt(c.computed.financial);
    const tdT = document.createElement('td'); tdT.innerHTML = `<span class="score-chip">${fmt(c.computed.total)}</span>`;
    const tdQ = document.createElement('td'); tdQ.textContent = quadrantOf(c);

    const tdA = document.createElement('td');
    const rm = document.createElement('button');
    rm.className = 'remove-btn';
    rm.textContent = 'Remove';
    rm.type = 'button';
    rm.addEventListener('click', () => {
      state.candidates = state.candidates.filter((x) => x.id !== c.id);
      ensureCompareSelection();
      recomputeAll();
      save();
      renderAll();
    });
    tdA.appendChild(rm);

    tr.append(tdRank, tdName, tdNF, tdF, tdT, tdQ, tdA);
    tbody.appendChild(tr);
  });
}

function renderWeights() {
  const wrap = els.weightsContainer;
  wrap.innerHTML = '';
  getMetrics().forEach((m) => {
    const row = document.createElement('div');
    row.className = 'weight-row';

    const label = document.createElement('div');
    label.textContent = `${displayColumn(m.column)} · ${m.label}`;

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.1';
    inp.min = '0';
    inp.value = m.weight;
    inp.addEventListener('input', () => {
      m.weight = num(inp.value) ?? 0;
      recomputeAll();
      save();
      renderAll();
    });

    row.append(label, inp);
    wrap.appendChild(row);
  });

  const rubrics = getRubrics();
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
  els.toggleScatterControls.textContent = state.scatterControlsOpen ? 'Hide Controls' : 'Scatter Controls';
  els.nfInput.value = Number(state.thresholds.nf ?? 0);
  els.fInput.value = Number(state.thresholds.f ?? 0);
  els.labelMode.value = state.labelMode;

  els.searchInput.value = state.search;
  els.sortSelect.value = state.sort;
  els.quadrantSelect.value = state.quadrant;
}

function renderAll() {
  renderControls();
  renderScatter();
  renderRanking();
  renderDistribution();
  renderQuadrantPieChart();
  renderRankingContributionChart();
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
    state.thresholds.nf = Math.round(avg(state.candidates.map((c) => c.computed.nonFinancial)));
    state.thresholds.f = Math.round(avg(state.candidates.map((c) => c.computed.financial)));
    save();
    renderAll();
  });

  els.useMedian.addEventListener('click', () => {
    state.thresholds.nf = Math.round(median(state.candidates.map((c) => c.computed.nonFinancial)));
    state.thresholds.f = Math.round(median(state.candidates.map((c) => c.computed.financial)));
    save();
    renderAll();
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

  els.createBtn.addEventListener('click', () => {
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
    };

    state.candidates.unshift(candidate);
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
    hydrate(freshSnapshot());
    state.newDraft = null;
    save();
    renderAll();
  });

  els.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vc-scouting-workbench-export.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const snap = JSON.parse(text);
      if (!snap?.model || !Array.isArray(snap?.candidates)) throw new Error('Invalid JSON format');
      hydrate(snap);
      state.newDraft = null;
      save();
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
  });
}

async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
    state.original = await res.json();

    const local = loadSaved();
    if (local?.model && Array.isArray(local?.candidates)) hydrate(local);
    else hydrate(freshSnapshot());

    attachEvents();
    renderAll();
  } catch (err) {
    document.body.innerHTML = `<main style="padding:20px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif">Failed to initialize app: ${escapeHtml(err.message)}</main>`;
    console.error(err);
  }
}

init();
