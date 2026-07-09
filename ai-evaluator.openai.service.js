const {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_BASE_URL,
} = require('./api.config');

function hasOpenAiConfig() {
  return Boolean(OPENAI_API_KEY);
}

function createOpenAiEvaluator() {
  return {
    isConfigured() {
      return hasOpenAiConfig();
    },

    async evaluateStartup({ startup, metrics, rubrics }) {
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
      }

      const metricSchema = metrics.map((metric) => ({
        column: metric.column,
        label: metric.label,
        weight: Number(metric.weight) || 0,
        group: metric.group || 'other',
        analystScore: startup.scores?.[metric.column] ?? null,
        externalScore: startup.externalScores?.[metric.column] ?? null,
        analystNotes: startup.notes?.[metric.column] || '',
        rubric: rubrics.find((rubric) => rubric.column === metric.column)?.rubric || '',
      }));

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
                      required: ['column', 'score', 'rationale'],
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
                      },
                    },
                  },
                },
              },
            },
          },
          messages: [
            {
              role: 'system',
              content: [
                'You are an institutional VC startup evaluation assistant.',
                'Score each metric from 1 to 5 based primarily on the analyst notes.',
                'Use external user score as a soft reference, not as a binding answer.',
                'When notes are thin, score conservatively and explain the uncertainty.',
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
                },
                metrics: metricSchema,
              }),
            },
          ],
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
