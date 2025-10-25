// Pre-optimized: mechanics_popular_by_avg_gt8
// Aggregation: start from mechanics_clean, lookup games_clean, compute per-mechanic metrics
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

const results = db.mechanics_clean.aggregate(pipeline).toArray();

// Top 3 by number of games
const top3 = results.slice(0, 3);
// Bottom 3 by avgRating but still above 8
const filteredByAvg = results.filter(r => r.avgRating > 8).sort((a, b) => a.avgRating - b.avgRating);
const bottom3 = filteredByAvg.slice(0, 3);

// Stability check: avg stddev for top mechanics vs overall
const overallAvgStd = results.reduce((s, r) => s + (r.stddevRating || 0), 0) / (results.length || 1);
const top10 = results.slice(0, 10);
const top10AvgStd = top10.reduce((s, r) => s + (r.stddevRating || 0), 0) / (top10.length || 1);

printjson({ label: 'mechanics_popular_by_avg_gt8_pre', totalMechanics: results.length, top3, bottom3, overallAvgStd, top10AvgStd });
