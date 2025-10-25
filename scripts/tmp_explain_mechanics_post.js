// tmp_explain_mechanics_post.js
// Auto-generated helper: run explain('executionStats') for the POST mechanics pipeline
const db = db.getSiblingDB('mongo_database');

const pipeline = [
  { $project: { BGGId: 1, _id: 0, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.v': 1, 'arr.k': { $nin: ['BGGId'] } } },
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
printjson({ script: '01_mechanics_popular_by_avg_gt8_post.js', explain: explainRes });
