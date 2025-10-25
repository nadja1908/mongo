// Post-optimized (index-friendly): mechanics_popular_by_avg_gt8
// This version uses the derived collection `mechanic_to_games` so we avoid scanning
// `mechanics_clean` and can use indexes on the derived collection.
//
// Indexes used by this POST implementation (run these after migration):
// db.mechanic_to_games.createIndex({ mechanic: 1, AvgRating: -1 })
//   - helps: filter by AvgRating and retrieve top games per mechanic efficiently
// db.mechanic_to_games.createIndex({ BGGId: 1 })
//   - helps: joins/lookups during migration and any reinflation by BGGId
// db.games_metrics.createIndex({ AvgRating: -1 })
//   - used during migration and useful as a fallback on game-side queries
const db = db.getSiblingDB('mongo_database');

// Use derived collection `mechanic_to_games` (pre-computed mapping) so we avoid scanning mechanics_clean
const pipeline = [
  // Filter games by AvgRating on the derived mapping
  { $match: { AvgRating: { $gt: 8 } } },
  { $group: {
      _id: '$mechanic',
      countGames: { $sum: 1 },
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      sumNumOwned: { $sum: '$NumOwned' },
      stddevRating: { $stdDevSamp: '$AvgRating' }
  } },
  { $sort: { countGames: -1 } }
];

const cursor = db.mechanic_to_games.aggregate(pipeline, { allowDiskUse: true });
const results = cursor.toArray();

const top3 = results.slice(0,3);
const filteredByAvg = results.filter(r => r.avgRating > 8).sort((a,b) => b.avgRating - a.avgRating);
const bottom3 = filteredByAvg.slice(-3).reverse();

const overallAvgStd = results.reduce((s, r) => s + (r.stddevRating || 0), 0) / (results.length || 1);
const top10 = results.slice(0, 10);
const top10AvgStd = top10.reduce((s, r) => s + (r.stddevRating || 0), 0) / (top10.length || 1);

printjson({ label: 'mechanics_popular_by_avg_gt8_post', totalMechanics: results.length, top3, bottom3, overallAvgStd, top10AvgStd });
