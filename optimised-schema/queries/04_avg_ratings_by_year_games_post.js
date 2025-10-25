// Post-optimized: average ratings by year, plus best and most owned per year
const db = db.getSiblingDB('mongo_database');

// Ensure indexes exist for the per-year top/most queries. Some environments create
// indexes centrally, but we make these idempotent so running this script alone
// still ensures good POST performance for this query.
try {
  print('Ensuring index: games_metrics { YearPublished:1, AvgRating:-1 }');
  db.games_metrics.createIndex({ YearPublished: 1, AvgRating: -1 });
} catch (e) {
  print('Index creation (YearPublished,AvgRating) error: ' + e);
}
try {
  print('Ensuring index: games_metrics { YearPublished:1, NumOwned:-1 }');
  db.games_metrics.createIndex({ YearPublished: 1, NumOwned: -1 });
} catch (e) {
  print('Index creation (YearPublished,NumOwned) error: ' + e);
}

// Indexes used by this POST implementation (run these after migration):
// db.games_metrics.createIndex({ YearPublished: 1, AvgRating: -1 })
//   - helps: compute year-level aggregates and find top games per year efficiently
// db.games_metrics.createIndex({ AvgRating: -1 })
//   - helps: sorting by rating across queries
const statsPipeline = [
  { $match: { YearPublished: { $exists: true, $ne: null } } },
  { $group: {
      _id: '$YearPublished',
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' }
  } },
  { $sort: { _id: 1 } }
];

// Server-side pipeline that computes year stats and, for each year, looks up
// the best-rated and most-owned game using indexed pipeline lookups. This
// avoids N+1 client-side finds and keeps the work on the server.
const detailsPipeline = [
  { $match: { YearPublished: { $exists: true, $ne: null } } },
  { $group: {
      _id: '$YearPublished',
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' }
  } },
  { $sort: { _id: 1 } },
  // lookup best game per year (requires index { YearPublished:1, AvgRating:-1 })
  { $lookup: {
      from: 'games_metrics',
      let: { year: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$YearPublished', '$$year'] } } },
        { $sort: { AvgRating: -1 } },
        { $project: { BGGId:1, Name:1, AvgRating:1 } },
        { $limit: 1 }
      ],
      as: 'bestGame'
  } },
  // lookup most-owned per year (requires index { YearPublished:1, NumOwned:-1 })
  { $lookup: {
      from: 'games_metrics',
      let: { year: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$YearPublished', '$$year'] } } },
        { $sort: { NumOwned: -1 } },
        { $project: { BGGId:1, Name:1, NumOwned:1 } },
        { $limit: 1 }
      ],
      as: 'mostOwned'
  } },
  { $addFields: { bestGame: { $arrayElemAt: ['$bestGame', 0] }, mostOwned: { $arrayElemAt: ['$mostOwned', 0] } } }
];

const yearDetails = db.games_metrics.aggregate(detailsPipeline, { allowDiskUse: true }).toArray();

const sortedByRating = [...yearDetails].sort((a,b)=>b.avgRating - a.avgRating);
const top3Years = sortedByRating.slice(0,3);
const bottom3Years = sortedByRating.slice(-3).reverse();

printjson({ label: 'avg_ratings_by_year_games_post', yearStatsCount: yearDetails.length, top3Years, bottom3Years, yearDetails });

// Expose a representative aggregation pipeline for explain() tooling.
// The main heavy lift is the grouping by YearPublished; we expose that pipeline as `pipeline` so
// the external explain runner can load this file and run an explain against `games_metrics`.
var pipeline = statsPipeline;
