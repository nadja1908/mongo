// Inverted optimized: start from games_clean filtered by AvgRating>8
// Lookup mechanics_clean and aggregate per mechanic
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

// run with allowDiskUse in case grouping is not tiny
const cursor = db.games_clean.aggregate(pipeline, { allowDiskUse: true });
const results = cursor.toArray();

const top3 = results.slice(0,3);
const filteredByAvg = results.filter(r => r.avgRating > 8).sort((a,b) => b.avgRating - a.avgRating);
const bottom3 = filteredByAvg.slice(-3).reverse();

const overallAvgStd = results.reduce((s, r) => s + (r.stddevRating || 0), 0) / (results.length || 1);
const top10 = results.slice(0, 10);
const top10AvgStd = top10.reduce((s, r) => s + (r.stddevRating || 0), 0) / (top10.length || 1);

printjson({ label: 'mechanics_popular_by_avg_gt8_inverted', totalMechanics: results.length, top3, bottom3, overallAvgStd, top10AvgStd });
