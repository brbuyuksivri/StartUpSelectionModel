const {
  initDb,
  readSnapshot,
  saveCandidate,
  saveEvaluation,
  listEvaluationJobs,
  enqueueEvaluationJob,
  claimNextEvaluationJob,
  completeEvaluationJob,
  failEvaluationJob,
} = require('./api.database');
const { createEvaluationJobsService } = require('./evaluation-jobs.service');
const { createOpenAiEvaluator } = require('./ai-evaluator.openai.service');

async function startWorker() {
  await initDb();
  const aiEvaluator = createOpenAiEvaluator();
  const evaluationJobsService = createEvaluationJobsService({
    readSnapshot,
    saveCandidate,
    saveEvaluation,
    listEvaluationJobs,
    enqueueEvaluationJob,
    claimNextEvaluationJob,
    completeEvaluationJob,
    failEvaluationJob,
    aiEvaluator,
  });

  const result = await evaluationJobsService.processNext();
  if (!result) {
    console.log('VC worker started. No queued evaluation jobs.');
    return null;
  }

  console.log(`Processed evaluation job ${result.jobId} for startup ${result.evaluation.startupId}.`);
  return result;
}

if (require.main === module) {
  startWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { startWorker };
