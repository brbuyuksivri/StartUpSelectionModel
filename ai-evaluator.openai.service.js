const {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_BASE_URL,
} = require('./api.config');

function hasOpenAiConfig() {
  return Boolean(OPENAI_API_KEY);
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
      return hasOpenAiConfig();
    },

    async evaluateStartup({ startup, metrics }) {
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
    },
  };
}

module.exports = {
  createOpenAiEvaluator,
  hasOpenAiConfig,
};
