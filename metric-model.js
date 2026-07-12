(function attachMetricModel(factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.VCMetricModel = api;
  }
})(function createMetricModel() {
  const SCORE_SCALE = [1, 2, 3, 4, 5];
  const SECTION_TITLES = {
    foundation: 'Foundation',
    commercial: 'Commercial',
    scale: 'Team & Scale',
    capital: 'Capital & Strategy',
    custom: 'Custom',
  };
  const GROUP_OPTIONS = ['nonFinancial', 'financial', 'other'];
  const PIPELINE_STAGES = [
    { key: 'on-deck', label: 'On Deck' },
    { key: 'first-look', label: 'First Look' },
    { key: 'deep-dive', label: 'Deep Dive' },
    { key: 'ic-ready', label: 'IC Ready' },
    { key: 'pass', label: 'Pass' },
  ];
  const LEGACY_PIPELINE_STAGES = {
    sourcing: 'on-deck',
    watchlist: 'first-look',
    diligence: 'deep-dive',
    'on deck': 'on-deck',
    firstlook: 'first-look',
    deepdive: 'deep-dive',
  };
  const LEGACY_SOURCE_BY_ACTIVE = {
    A: 'B',
    B: 'C',
    C: 'D',
    D: 'E',
    E: 'F',
    F: 'G',
    G: 'H',
    H: 'I',
  };

  const INITIAL_METRICS = [
    {
      id: 'company-overview',
      column: 'A',
      key: 'company-overview',
      label: 'Company Overview',
      originalLabel: 'Genel Bakış / Şirket',
      sectionKey: 'foundation',
      sectionLabel: 'Foundation',
      group: 'nonFinancial',
      weight: 12.5,
      evidencePrompts: [
        'Is the company’s traction, revenue base, and operating history appropriate for its current stage?',
        'Is the company’s operating location appropriate for its target market?',
        'Who are the prior investors or backers?',
      ],
    },
    {
      id: 'market-competition',
      column: 'B',
      key: 'market-competition',
      label: 'Market & Competition',
      originalLabel: 'Pazar ve Rekabet',
      sectionKey: 'foundation',
      sectionLabel: 'Foundation',
      group: 'nonFinancial',
      weight: 14,
      evidencePrompts: [
        'Is the market size and growth potential attractive for the problem being solved?',
        'How intense is competition in the market?',
        'What sustainable competitive advantages does the startup have?',
        'What are the entry barriers and opportunity openings in the market?',
      ],
    },
    {
      id: 'revenue-business-model',
      column: 'C',
      key: 'revenue-business-model',
      label: 'Revenue & Business Model',
      originalLabel: 'Gelir ve İş Modeli',
      sectionKey: 'commercial',
      sectionLabel: 'Commercial',
      group: 'nonFinancial',
      weight: 12.5,
      evidencePrompts: [
        'What is the sales strategy, who owns sales, and are external channels used (B2B, B2C, B2G)?',
        'Has the TAM, SAM, and SOM analysis been evaluated, how was it calculated, and how reliable is it?',
        'How does the sales cycle progress in practice?',
      ],
    },
    {
      id: 'product-differentiation',
      column: 'D',
      key: 'product-differentiation',
      label: 'Product & Differentiation',
      originalLabel: 'Ürün ve Rekabet',
      sectionKey: 'commercial',
      sectionLabel: 'Commercial',
      group: 'nonFinancial',
      weight: 16,
      evidencePrompts: [
        'What market need does the product address and what value does it deliver?',
        'What are the key product milestones so far (sales, demo, POC, prototype, beta, field tests)?',
        'How different or superior is the product versus current alternatives?',
        'How do you assess privacy and regulatory requirements such as GDPR and similar compliance needs?',
        'Is the product potentially a game changer for its target market?',
      ],
    },
    {
      id: 'team',
      column: 'E',
      key: 'team',
      label: 'Team',
      originalLabel: 'Ekip',
      sectionKey: 'scale',
      sectionLabel: 'Team & Scale',
      group: 'nonFinancial',
      weight: 15,
      evidencePrompts: [
        'Who are the founders, key team members, and advisors, and how strong is their sector fit?',
        'Does the team have experience in business development, management, founding, scaling, or failing ventures?',
        'Has the team worked together before? What are the balance gaps and weaknesses?',
        'Are the founders committed for the long term and fully focused?',
        'What critical roles are missing and is there a plan to fill them?',
        'How open is the team to investor support and smart-money strategies?',
      ],
    },
    {
      id: 'global-expansion-scalability',
      column: 'F',
      key: 'global-expansion-scalability',
      label: 'Global Expansion & Scalability',
      originalLabel: 'Globalleşme ve Ölçeklenebilirlik',
      sectionKey: 'scale',
      sectionLabel: 'Team & Scale',
      group: 'nonFinancial',
      weight: 10,
      evidencePrompts: [
        'How ready is the startup operationally, and is there a coordinated execution plan?',
        'Is delivery dependent on third-party suppliers?',
        'How scalable are the business model and infrastructure?',
        'How can cost flexibility be maintained in slow or aggressive growth scenarios?',
        'What are the major business, legal, and regulatory risks?',
      ],
    },
    {
      id: 'financial-health-investment',
      column: 'G',
      key: 'financial-health-investment',
      label: 'Financial Health & Investment',
      originalLabel: 'Finansal Durum ve Yatırım',
      sectionKey: 'capital',
      sectionLabel: 'Capital & Strategy',
      group: 'financial',
      weight: 12.5,
      evidencePrompts: [
        'What are the short-, mid-, and long-term revenue growth projections?',
        'When is positive cash flow expected?',
        'How do you assess the founder’s approach to investor selection?',
        'How will the investment be used?',
        'How healthy is the cap table among founders and key stakeholders?',
        'Is there a detailed financial model?',
        'Are the founders sufficiently financially literate and is there an internal finance function?',
        'Is the requested valuation fair and grounded?',
        'What is the profitability profile (gross margin, EBITDA, net income)?',
      ],
    },
    {
      id: 'strategic-fit-exit',
      column: 'H',
      key: 'strategic-fit-exit',
      label: 'Strategic Fit & Exit',
      originalLabel: 'Strateji Bağlantısı',
      sectionKey: 'capital',
      sectionLabel: 'Capital & Strategy',
      group: 'financial',
      weight: 7.5,
      evidencePrompts: [
        'Can the company create synergy with portfolio companies and benefit from smart money?',
        'Is there clear alignment with the exit strategy?',
      ],
    },
  ];

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'metric';
  }

  function columnForIndex(index) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index < alphabet.length) return alphabet[index];
    return `M${index + 1}`;
  }

  function sectionLabelFor(key) {
    return SECTION_TITLES[key] || key || SECTION_TITLES.custom;
  }

  function normalizeStage(stage) {
    const raw = String(stage || '').trim().toLowerCase();
    if (!raw) return 'on-deck';
    if (PIPELINE_STAGES.some((item) => item.key === raw)) return raw;
    if (Object.prototype.hasOwnProperty.call(LEGACY_PIPELINE_STAGES, raw)) return LEGACY_PIPELINE_STAGES[raw];
    return 'on-deck';
  }

  function stageLabel(stage) {
    const normalized = normalizeStage(stage);
    return PIPELINE_STAGES.find((item) => item.key === normalized)?.label || 'On Deck';
  }

  function normalizeSection(section, index = 0) {
    const key = String(section?.key || slugify(section?.title || `section-${index + 1}`)).trim() || `section-${index + 1}`;
    return {
      key,
      title: String(section?.title || sectionLabelFor(key)).trim() || sectionLabelFor(key),
      description: String(section?.description || '').trim(),
    };
  }

  function normalizeEvidencePrompts(prompts) {
    if (Array.isArray(prompts)) return prompts.map((item) => String(item || '').trim()).filter(Boolean);
    if (!prompts) return [];
    return String(prompts)
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function defaultScoreDescriptions(label) {
    return {
      1: `Evidence on ${label} is weak, incomplete, or materially inconsistent.`,
      2: `${label} shows early but below-threshold signals with meaningful gaps still unresolved.`,
      3: `${label} is adequate for stage, but conviction is mixed and key proof points remain limited.`,
      4: `${label} is strong, well supported, and above the normal quality bar for the current stage.`,
      5: `${label} is exceptional, highly differentiated, and supported by clear best-in-class evidence.`,
    };
  }

  function normalizeScoreDescriptions(label, scoreDescriptions) {
    const defaults = defaultScoreDescriptions(label);
    const next = {};
    SCORE_SCALE.forEach((score) => {
      next[score] = String(scoreDescriptions?.[score] || scoreDescriptions?.[String(score)] || defaults[score]).trim();
    });
    return next;
  }

  function formatRubricText(metric) {
    const blocks = SCORE_SCALE.map((score) => `${score}: ${metric.scoreDescriptions[score]}`);
    if (metric.evidencePrompts.length) {
      blocks.push('');
      blocks.push('Evidence prompts:');
      metric.evidencePrompts.forEach((prompt) => {
        blocks.push(`- ${prompt}`);
      });
    }
    return blocks.join('\n');
  }

  function normalizeMetric(metric, index) {
    const label = String(metric?.label || metric?.name || `Metric ${index + 1}`).trim();
    const sectionKey = String(metric?.sectionKey || metric?.section || 'custom').trim() || 'custom';
    const evidencePrompts = normalizeEvidencePrompts(metric?.evidencePrompts || metric?.questions || metric?.descriptionPrompts);
    const scoreDescriptions = normalizeScoreDescriptions(label, metric?.scoreDescriptions);
    return {
      id: String(metric?.id || slugify(label)),
      key: String(metric?.key || slugify(label)),
      column: String(metric?.column || columnForIndex(index)).trim(),
      label,
      originalLabel: String(metric?.originalLabel || '').trim(),
      sectionKey,
      sectionLabel: String(metric?.sectionLabel || sectionLabelFor(sectionKey)).trim(),
      group: GROUP_OPTIONS.includes(metric?.group) ? metric.group : 'other',
      weight: Number(metric?.weight) || 0,
      evidencePrompts,
      scoreDescriptions,
      rubric: String(metric?.rubric || '').trim(),
    };
  }

  function deriveSections(metrics, rawSections = []) {
    const normalizedSections = Array.isArray(rawSections)
      ? rawSections.map((section, index) => normalizeSection(section, index))
      : [];
    const byKey = new Map(normalizedSections.map((section) => [section.key, section]));
    metrics.forEach((metric) => {
      if (!byKey.has(metric.sectionKey)) {
        byKey.set(metric.sectionKey, normalizeSection({
          key: metric.sectionKey,
          title: metric.sectionLabel,
        }, byKey.size));
      }
    });
    return [...byKey.values()];
  }

  function deriveWeights(metrics) {
    return metrics.map((metric) => ({
      column: metric.column,
      label: metric.label,
      weight: metric.weight,
      group: metric.group,
      sectionKey: metric.sectionKey,
      sectionLabel: metric.sectionLabel,
    }));
  }

  function deriveRubrics(metrics) {
    return metrics.map((metric) => ({
      column: metric.column,
      label: metric.label,
      group: metric.group,
      sectionKey: metric.sectionKey,
      sectionLabel: metric.sectionLabel,
      rubric: metric.rubric || formatRubricText(metric),
      evidencePrompts: metric.evidencePrompts,
      scoreDescriptions: metric.scoreDescriptions,
    }));
  }

  function buildFormulaText(metrics) {
    const grouped = metrics.reduce((acc, metric) => {
      const key = metric.group || 'other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(metric.column);
      return acc;
    }, {});
    const summarize = (key) => {
      const columns = grouped[key] || [];
      if (!columns.length) return '0';
      return `SUMPRODUCT(${columns.join(', ')}, weights ${columns.join(', ')})`;
    };
    return {
      nonFinancial: summarize('nonFinancial'),
      financial: summarize('financial'),
      total: 'nonFinancial + financial + other',
    };
  }

  function createInitialMetrics() {
    return INITIAL_METRICS.map((metric, index) => {
      const normalized = normalizeMetric(metric, index);
      return {
        ...normalized,
        rubric: formatRubricText(normalized),
      };
    });
  }

  function normalizeModel(rawModel) {
    const normalizedSections = Array.isArray(rawModel?.sections)
      ? rawModel.sections.map((section, index) => normalizeSection(section, index))
      : [];
    const sectionMap = new Map(normalizedSections.map((section) => [section.key, section.title]));
    const metrics = Array.isArray(rawModel?.metrics) && rawModel.metrics.length
      ? rawModel.metrics.map((metric, index) => normalizeMetric(metric, index))
      : createInitialMetrics();
    const finalizedMetrics = metrics.map((metric, index) => ({
      ...metric,
      column: String(metric.column || columnForIndex(index)).trim(),
      sectionLabel: String(sectionMap.get(metric.sectionKey) || metric.sectionLabel || sectionLabelFor(metric.sectionKey)).trim(),
      rubric: metric.rubric || formatRubricText(metric),
    }));
    const finalizedSections = deriveSections(finalizedMetrics, normalizedSections);

    return {
      ...(rawModel || {}),
      scoreScale: Array.isArray(rawModel?.scoreScale)
        && rawModel.scoreScale.length === SCORE_SCALE.length
        && rawModel.scoreScale.every((value, index) => Number(value) === SCORE_SCALE[index])
        ? rawModel.scoreScale
        : SCORE_SCALE,
      sections: finalizedSections,
      metrics: finalizedMetrics,
      weights: deriveWeights(finalizedMetrics),
      metricRubrics: deriveRubrics(finalizedMetrics),
      formulas: buildFormulaText(finalizedMetrics),
    };
  }

  function normalizeMetricPayload(payload, columns, fallbackValue, defaultValue) {
    const source = payload || {};
    const next = {};
    columns.forEach((column) => {
      if (Object.prototype.hasOwnProperty.call(source, column)) {
        next[column] = source[column];
        return;
      }
      const legacyColumn = LEGACY_SOURCE_BY_ACTIVE[column];
      if (legacyColumn && Object.prototype.hasOwnProperty.call(source, legacyColumn)) {
        next[column] = source[legacyColumn];
        return;
      }
      next[column] = typeof defaultValue === 'function' ? defaultValue(column) : defaultValue;
    });
    return next;
  }

  function normalizeCandidate(candidate, model, index = null) {
    const normalizedModel = normalizeModel(model || {});
    const columns = normalizedModel.metrics.map((metric) => metric.column);
    return {
      ...candidate,
      id: candidate?.id || `seed_${index ?? Math.random().toString(36).slice(2, 8)}`,
      sourceIndex: candidate?.sourceIndex ?? index,
      name: candidate?.name || 'Unnamed candidate',
      normalizedName: candidate?.normalizedName || '',
      scores: normalizeMetricPayload(candidate?.scores, columns, LEGACY_SOURCE_BY_ACTIVE, null),
      externalScores: normalizeMetricPayload(candidate?.externalScores, columns, LEGACY_SOURCE_BY_ACTIVE, null),
      aiScores: normalizeMetricPayload(candidate?.aiScores, columns, LEGACY_SOURCE_BY_ACTIVE, null),
      aiRationales: normalizeMetricPayload(candidate?.aiRationales, columns, LEGACY_SOURCE_BY_ACTIVE, ''),
      notes: normalizeMetricPayload(candidate?.notes, columns, LEGACY_SOURCE_BY_ACTIVE, ''),
      computedFromExcel: candidate?.computedFromExcel || null,
      isNew: Boolean(candidate?.isNew),
      tags: Array.isArray(candidate?.tags) ? candidate.tags : [],
      stage: normalizeStage(candidate?.stage),
      lastAiEvaluationId: candidate?.lastAiEvaluationId || null,
      detail: candidate?.detail || null,
    };
  }

  function createEmptyMetric(index, seed = {}) {
    const label = String(seed.label || `New Metric ${index + 1}`).trim();
    const normalized = normalizeMetric({
      id: seed.id || slugify(label),
      key: seed.key || slugify(label),
      column: seed.column || columnForIndex(index),
      label,
      originalLabel: seed.originalLabel || '',
      sectionKey: seed.sectionKey || 'custom',
      sectionLabel: seed.sectionLabel || sectionLabelFor(seed.sectionKey || 'custom'),
      group: seed.group || 'other',
      weight: Number(seed.weight) || 5,
      evidencePrompts: seed.evidencePrompts || [],
      scoreDescriptions: seed.scoreDescriptions || defaultScoreDescriptions(label),
    }, index);
    return {
      ...normalized,
      rubric: formatRubricText(normalized),
    };
  }

  function createEmptySection(index, seed = {}) {
    return normalizeSection({
      key: seed.key || slugify(seed.title || `new-section-${index + 1}`),
      title: seed.title || `New Section ${index + 1}`,
    }, index);
  }

  return {
    SCORE_SCALE,
    SECTION_TITLES,
    GROUP_OPTIONS,
    createInitialMetrics,
    normalizeModel,
    normalizeCandidate,
    normalizeStage,
    stageLabel,
    PIPELINE_STAGES,
    defaultScoreDescriptions,
    formatRubricText,
    createEmptyMetric,
    createEmptySection,
    sectionLabelFor,
    normalizeSection,
    slugify,
  };
});
