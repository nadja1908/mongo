// Post-optimized (index-friendly): mechanics_popular_by_avg_gt8
// This version uses a localField/foreignField $lookup so the join can use the
// `games_clean.BGGId` index when types align. After the join we filter by AvgRating > 8.
const db = db.getSiblingDB('mongo_database');

const pipeline = [
  // Project only the mechanic flags and BGGId to reduce working set
  { $project: { BGGId: 1, _id: 0, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.v': 1, 'arr.k': { $nin: ['BGGId'] } } },
  // Use a simple localField/foreignField lookup (fast when types match)
  { $lookup: { from: 'games_clean', localField: 'BGGId', foreignField: 'BGGId', as: 'game' } },
  { $unwind: '$game' },
  // Now filter joined games by AvgRating to avoid scanning everything in JS
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

// Run aggregation with allowDiskUse in case the grouping is large
const cursor = db.mechanics_clean.aggregate(pipeline, { allowDiskUse: true });
const results = cursor.toArray();

const top3 = results.slice(0,3);
const filteredByAvg = results.filter(r => r.avgRating > 8).sort((a,b) => b.avgRating - a.avgRating);
const bottom3 = filteredByAvg.slice(-3).reverse();

const overallAvgStd = results.reduce((s, r) => s + (r.stddevRating || 0), 0) / (results.length || 1);
const top10 = results.slice(0, 10);
const top10AvgStd = top10.reduce((s, r) => s + (r.stddevRating || 0), 0) / (top10.length || 1);

printjson({ label: 'mechanics_popular_by_avg_gt8_post', totalMechanics: results.length, top3, bottom3, overallAvgStd, top10AvgStd });
