const scoringCore = require('./scoring-core');

function createEvaluationJobsService(deps) {
  function buildEvaluation(startup, weights, source, jobId = null, analysis = null) {
    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startupId: startup.id,
      summary: {
        computed: scoringCore.computeCandidate(startup, weights),
        generatedAt: new Date().toISOString(),
        source,
        jobId,
        analysis,
      },
    };
  }

  return {
    async list() {
      return deps.listEvaluationJobs();
    },

    async queue(startupId, options = {}) {
      if (!startupId) throw new Error('startupId is required');

      const snapshot = await deps.readSnapshot();
      const startup = snapshot.candidates.find((candidate) => candidate.id === startupId);
      if (!startup) throw new Error('Startup not found');

      const job = {
        id: `evaljob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        startupId,
        status: 'queued',
        payload: options.payload || {},
        requestedBy: options.requestedBy || 'system',
      };
      return deps.enqueueEvaluationJob(job);
    },

    async processNext() {
      const job = await deps.claimNextEvaluationJob();
      if (!job) return null;

      try {
        const snapshot = await deps.readSnapshot();
        const startup = snapshot.candidates.find((candidate) => candidate.id === job.startupId);
        if (!startup) throw new Error('Startup not found');

        const aiResult = await deps.aiEvaluator.evaluateStartup({
          startup,
          metrics: snapshot.model.weights,
          rubrics: snapshot.model.metricRubrics || [],
        });

        const nextAiScores = { ...(startup.aiScores || {}) };
        const nextAiRationales = { ...(startup.aiRationales || {}) };
        aiResult.metricScores.forEach((metricScore) => {
          nextAiScores[metricScore.column] = metricScore.score;
          nextAiRationales[metricScore.column] = metricScore.rationale;
        });

        const enrichedStartup = {
          ...startup,
          aiScores: nextAiScores,
          aiRationales: nextAiRationales,
        };

        const evaluation = buildEvaluation(enrichedStartup, snapshot.model.weights, 'openai-queue', job.id, {
          provider: aiResult.provider,
          model: aiResult.model,
          overallSummary: aiResult.overallSummary,
          confidence: aiResult.confidence,
          keyStrengths: aiResult.keyStrengths,
          keyRisks: aiResult.keyRisks,
          metricScores: aiResult.metricScores,
        });

        enrichedStartup.lastAiEvaluationId = evaluation.id;
        await deps.saveCandidate(enrichedStartup);
        await deps.saveEvaluation(evaluation);
        await deps.completeEvaluationJob(job.id, {
          evaluationId: evaluation.id,
          startupId: enrichedStartup.id,
          computed: evaluation.summary.computed,
          provider: aiResult.provider,
          model: aiResult.model,
        });
        return { jobId: job.id, evaluation, startup: enrichedStartup };
      } catch (error) {
        await deps.failEvaluationJob(job.id, error.message);
        throw error;
      }
    },
  };
}

module.exports = { createEvaluationJobsService };
