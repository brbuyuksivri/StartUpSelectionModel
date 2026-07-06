function startWorker() {
  console.log('VC worker scaffold started. No jobs are registered yet.');
}

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker };
