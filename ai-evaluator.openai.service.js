const {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_BASE_URL,
} = require('./api.config');

function hasOpenAiConfig() {
  return Boolean(OPENAI_API_KEY);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function keywordOverlap(note, rubric) {
  const noteTokens = new Set(tokenize(note));
  const rubricTokens = tokenize(rubric);
  if (!noteTokens.size || !rubricTokens.length) return 0;
  const overlap = rubricTokens.filter((token) => noteTokens.has(token)).length;
  return overlap / new Set(rubricTokens).size;
}

function noteEvidenceStrength(note) {
  const source = String(note || '').trim();
  if (!source) return 0;
  const words = tokenize(source);
  const numberHits = (source.match(/\b\d+([.,]\d+)?\b/g) || []).length;
  const concreteSignals = [
    'revenue', 'growth', 'retention', 'pilot', 'customers', 'customer', 'mrr', 'arr',
    'founder', 'team', 'market', 'margin', 'burn', 'runway', 'funding', 'investor',
    'users', 'usage', 'contract', 'pipeline', 'launch', 'product',
  ].filter((token) => words.includes(token)).length;
  const lengthSignal = clamp(words.length / 45, 0, 1);
  return clamp(lengthSignal * 0.45 + Math.min(numberHits, 4) * 0.1 + Math.min(concreteSignals, 6) * 0.08, 0, 1);
}

function heuristicMetricEvaluation(metric, startup) {
  const note = String(startup.notes?.[metric.column] || '').trim();
  const externalScore = Number(startup.externalScores?.[metric.column]);
  const scoreDescriptions = metric.scoreDescriptions || {};

  if (!note) {
    return {
      column: metric.column,
      score: 1,
      rationale: 'No analyst note was provided for this metric, so the score defaults to low conviction.',
      matchedDescription: String(scoreDescriptions['1'] || ''),
      missingEvidence: metric.evidencePrompts?.slice(0, 3) || [],
    };
  }

  const overlaps = [1, 2, 3, 4, 5].map((score) => ({
    score,
    overlap: keywordOverlap(note, scoreDescriptions[String(score)] || ''),
    description: String(scoreDescriptions[String(score)] || ''),
  }));
  overlaps.sort((a, b) => b.overlap - a.overlap || b.score - a.score);

  const evidenceStrength = noteEvidenceStrength(note);
  const overlapLeader = overlaps[0];
  const overlapRunnerUp = overlaps[1];
  const overlapSignal = overlapLeader.overlap > 0
    ? overlapLeader.score
    : clamp(Math.round(1 + evidenceStrength * 4), 1, 5);

  const externalSignal = Number.isFinite(externalScore)
    ? clamp(Math.round(externalScore), 1, 5)
    : overlapSignal;

  let score = clamp(Math.round(overlapSignal * 0.8 + externalSignal * 0.2), 1, 5);
  if (evidenceStrength < 0.3) score = Math.min(score, 2);
  else if (evidenceStrength < 0.5) score = Math.min(score, 3);

  const matchedDescription = String(scoreDescriptions[String(score)] || overlapLeader.description || '');
  const missingEvidence = (metric.evidencePrompts || [])
    .filter((prompt) => keywordOverlap(note, prompt) < 0.12)
    .slice(0, 3);

  const rationaleParts = [
    `Analyst note suggests a ${score}/5 level on ${metric.label}.`,
    evidenceStrength >= 0.65
      ? 'The note includes concrete, decision-useful evidence.'
      : evidenceStrength >= 0.4
        ? 'The note has some evidence, but not enough to justify a top score.'
        : 'The note is thin or incomplete, so the score stays conservative.',
  ];
  if (Number.isFinite(externalScore)) {
    rationaleParts.push(`External score ${externalSignal}/5 was used only as a secondary reference.`);
  }
  if (overlapRunnerUp && overlapLeader.overlap - overlapRunnerUp.overlap < 0.08 && score > 1) {
    rationaleParts.push('The note sits between rubric levels, so the lower score was chosen.');
  }

  return {
    column: metric.column,
    score,
    rationale: rationaleParts.join(' '),
    matchedDescription,
    missingEvidence,
  };
}

function fallbackEvaluation(startup, metrics, reason) {
  const metricScores = metrics.map((metric) => heuristicMetricEvaluation(metric, startup));
  const averageScore = metricScores.length
    ? metricScores.reduce((sum, item) => sum + item.score, 0) / metricScores.length
    : 0;
  const strengths = metricScores
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => `${item.column} ${metrics.find((metric) => metric.column === item.column)?.label || item.column}`);
  const risks = metricScores
    .filter((item) => item.score <= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => `${item.column} ${metrics.find((metric) => metric.column === item.column)?.label || item.column}`);

  return {
    provider: 'fallback',
    model: 'heuristic-rubric-v1',
    overallSummary: reason
      ? `Fallback AI review used because live OpenAI scoring was unavailable (${reason}). Scores were generated from analyst notes, metric rubrics, and external score reference values.`
      : 'Fallback AI review used. Scores were generated from analyst notes, metric rubrics, and external score reference values.',
    confidence: clamp(averageScore / 5, 0.2, 0.82),
    keyStrengths: strengths,
    keyRisks: risks,
    metricScores,
  };
}

function shouldFallback(error) {
  const message = String(error?.message || '');
  return [
    'insufficient_quota',
    'OPENAI_API_KEY is not configured',
    'OpenAI evaluation failed: 401',
    'OpenAI evaluation failed: 403',
    'OpenAI evaluation failed: 429',
    'OpenAI evaluation failed: 500',
    'OpenAI evaluation failed: 502',
    'OpenAI evaluation failed: 503',
    'OpenAI evaluation failed: 504',
    'fetch failed',
  ].some((fragment) => message.includes(fragment));
}

function buildMetricPayload(startup, metrics) {
  return metrics.map((metric) => ({
    column: metric.column,
    key: metric.key,
    label: metric.label,
    weight: Number(metric.weight) || 0,
    group: metric.group || 'other',
    section: metric.sectionLabel || metric.sectionKey || '',
    externalUserScore: startup.externalScores?.[metric.column] ?? null,
    analystNotes: String(startup.notes?.[metric.column] || '').trim(),
    evidencePrompts: Array.isArray(metric.evidencePrompts) ? metric.evidencePrompts : [],
    scoreDescriptions: metric.scoreDescriptions || {},
  }));
}

function buildEvaluationMessages(startup, metrics) {
  const detail = startup.detail || {};
  return [
    {
      role: 'system',
      content: [
        'You are an institutional VC startup evaluation assistant.',
        'Your task is to score each metric from 1 to 5 using the analyst-written notes for that specific metric.',
        'For each metric, compare the analyst note directly against that metric’s score descriptions.',
        'Treat the external user score as a weak secondary reference only. Do not copy it unless the note supports it.',
        'Do not use any analyst score as an input signal. Score from the note evidence itself.',
        'If the note is vague, incomplete, or missing proof, choose the lower score rather than the optimistic score.',
        'When evidence is too thin, use 1 or 2 and explain what is missing.',
        'Rationales must be concise, specific, and grounded in the provided note.',
        'Return valid JSON only.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        startup: {
          id: startup.id,
          name: startup.name,
          stage: startup.stage || 'sourcing',
          tags: Array.isArray(startup.tags) ? startup.tags : [],
          overview: {
            summary: String(detail?.overview?.summary || '').trim(),
            thesis: String(detail?.overview?.thesis || '').trim(),
            nextStep: String(detail?.overview?.nextStep || '').trim(),
          },
        },
        scoringInstructions: {
          scale: [1, 2, 3, 4, 5],
          rule: 'Choose exactly one integer score per metric.',
          tieBreak: 'If the evidence sits between two scores, choose the lower one unless the note explicitly supports the higher level.',
        },
        metrics: buildMetricPayload(startup, metrics),
      }),
    },
  ];
}

function createOpenAiEvaluator() {
  return {
    isConfigured() {
      return true;
    },

    async evaluateStartup({ startup, metrics }) {
      try {
        if (!OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is not configured');
        }

        const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.2,
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'startup_metric_evaluation',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['overallSummary', 'confidence', 'keyStrengths', 'keyRisks', 'metricScores'],
                  properties: {
                    overallSummary: { type: 'string' },
                    confidence: { type: 'number' },
                    keyStrengths: {
                      type: 'array',
                      items: { type: 'string' },
                      maxItems: 5,
                    },
                    keyRisks: {
                      type: 'array',
                      items: { type: 'string' },
                      maxItems: 5,
                    },
                    metricScores: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['column', 'score', 'rationale', 'matchedDescription', 'missingEvidence'],
                        properties: {
                          column: {
                            type: 'string',
                            enum: metrics.map((metric) => metric.column),
                          },
                          score: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 5,
                          },
                          rationale: { type: 'string' },
                          matchedDescription: { type: 'string' },
                          missingEvidence: {
                            type: 'array',
                            items: { type: 'string' },
                            maxItems: 3,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            messages: buildEvaluationMessages(startup, metrics),
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`OpenAI evaluation failed: ${response.status} ${text}`);
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        const text = typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map((item) => item?.text || item?.content || '').join('')
            : '';
        if (!text) {
          throw new Error('OpenAI evaluation returned no content');
        }

        const parsed = JSON.parse(text);
        return {
          provider: 'openai',
          model: OPENAI_MODEL,
          overallSummary: parsed.overallSummary,
          confidence: parsed.confidence,
          keyStrengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths : [],
          keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
          metricScores: Array.isArray(parsed.metricScores) ? parsed.metricScores : [],
        };
      } catch (error) {
        if (!shouldFallback(error)) throw error;
        const reason = String(error.message || '')
          .replace(/\s+/g, ' ')
          .slice(0, 220);
        return fallbackEvaluation(startup, metrics, reason);
      }
    },
  };
}

module.exports = {
  createOpenAiEvaluator,
  hasOpenAiConfig,
};
