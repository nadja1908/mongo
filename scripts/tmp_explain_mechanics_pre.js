// tmp_explain_mechanics_pre.js
// Auto-generated helper: run explain('executionStats') for the PRE mechanics pipeline
const db = db.getSiblingDB('mongo_database');

const pipeline = [
  { $project: { BGGId: 1, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.v': 1, 'arr.k': { $nin: ['_id', 'BGGId'] } } },
  { $lookup: { from: 'games_clean', localField: 'BGGId', foreignField: 'BGGId', as: 'game' } },
  { $unwind: '$game' },
  { $match: { 'game.AvgRating': { $gt: 8 } } },
  { $group: {
      _id: '$arr.k',
      countGames: { $sum: 1 },
      avgRating: { $avg: '$game.AvgRating' },
      avgBayes: { $avg: '$game.BayesAvgRating' },
      sumNumUserRatings: { $sum: '$game.NumUserRatings' },
      sumNumOwned: { $sum: '$game.NumOwned' },
      stddevRating: { $stdDevSamp: '$game.AvgRating' }
  } },
  { $sort: { countGames: -1 } }
];

const explainRes = db.getCollection('mechanics_clean').explain('executionStats').aggregate(pipeline);
printjson({ script: '01_mechanics_popular_by_avg_gt8_pre.js', explain: explainRes });
