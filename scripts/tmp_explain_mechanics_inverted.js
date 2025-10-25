// tmp_explain_mechanics_inverted.js
const db = db.getSiblingDB('mongo_database');

const pipeline = [
  { $match: { AvgRating: { $gt: 8 } } },
  { $project: { BGGId: 1, AvgRating: 1, BayesAvgRating: 1, NumUserRatings: 1, NumOwned: 1 } },
  { $lookup: { from: 'mechanics_clean', localField: 'BGGId', foreignField: 'BGGId', as: 'mech' } },
  { $unwind: '$mech' },
  { $project: { BGGId: 1, AvgRating: 1, BayesAvgRating: 1, NumUserRatings: 1, NumOwned: 1, arr: { $objectToArray: '$mech' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.v': 1, 'arr.k': { $nin: ['_id', 'BGGId'] } } },
  { $group: {
      _id: '$arr.k',
      countGames: { $sum: 1 },
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      sumNumUserRatings: { $sum: '$NumUserRatings' },
      sumNumOwned: { $sum: '$NumOwned' },
      stddevRating: { $stdDevSamp: '$AvgRating' }
  } },
  { $sort: { countGames: -1 } }
];

const explainRes = db.getCollection('games_clean').explain('executionStats').aggregate(pipeline);
printjson({ script: '01_mechanics_popular_by_avg_gt8_inverted.js', explain: explainRes });
