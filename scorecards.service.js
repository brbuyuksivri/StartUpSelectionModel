function createScorecardsService(deps) {
  return {
    async list() {
      return deps.listScorecards();
    },
    async getActive() {
      const scorecards = await deps.listScorecards();
      return scorecards.find((scorecard) => scorecard.isActive) || scorecards[0] || null;
    },
  };
}

module.exports = { createScorecardsService };
