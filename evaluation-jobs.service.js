const scoringCore = require('./scoring-core');

function createEvaluationJobsService(deps) {
  function buildEvaluation(startup, metrics, source, jobId = null, analysis = null) {
    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startupId: startup.id,
      summary: {
        computed: scoringCore.computeCandidate(startup, metrics),
        generatedAt: new Date().toISOString(),
        source,
        jobId,
        analysis,
      },
    };
  }

  async function evaluateStartupDirect(startup, metrics, source, jobId = null, meta = {}) {
    const aiResult = await deps.aiEvaluator.evaluateStartup({
      startup,
      metrics,
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

    const evaluation = buildEvaluation(enrichedStartup, metrics, source, jobId, {
      provider: aiResult.provider,
      model: aiResult.model,
      overallSummary: aiResult.overallSummary,
      confidence: aiResult.confidence,
      keyStrengths: aiResult.keyStrengths,
      keyRisks: aiResult.keyRisks,
      metricScores: aiResult.metricScores,
      ...meta,
    });

    enrichedStartup.lastAiEvaluationId = evaluation.id;
    await deps.saveCandidate(enrichedStartup);
    await deps.saveEvaluation(evaluation);
    return { evaluation, startup: enrichedStartup, aiResult };
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
        const metrics = snapshot.model.metrics || [];
        const { evaluation, startup: enrichedStartup, aiResult } = await evaluateStartupDirect(startup, metrics, 'openai-queue', job.id, {
          trigger: job.payload?.trigger || 'queued-job',
          requestedBy: job.requestedBy || 'system',
        });
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

    async runNow(startupId, options = {}) {
      if (!startupId) throw new Error('startupId is required');
      const snapshot = await deps.readSnapshot();
      const startup = snapshot.candidates.find((candidate) => candidate.id === startupId);
      if (!startup) throw new Error('Startup not found');
      const metrics = snapshot.model.metrics || [];
      return evaluateStartupDirect(startup, metrics, 'openai-direct', null, {
        trigger: options.payload?.trigger || 'direct-run',
        requestedBy: options.requestedBy || 'frontend-direct',
      });
    },
  };
}

module.exports = { createEvaluationJobsService };
