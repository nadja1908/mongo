// Post-optimized: avg rating by designer-publisher (inverted pipeline)
// Strategy: start from games_clean (filtering early), then lookup into designers_reduced_clean
// so we can apply game-side filters (NumUserRatings >= threshold) and use game-side indexes.
const db = db.getSiblingDB('mongo_database');

// Threshold used by the original pipeline's post-match
const MIN_USER_RATINGS = 500;

// Indexes used by this POST implementation (run these after migration):
// db.designer_publisher_agg.createIndex({ avgRating: -1 })
//   - helps: returning top designer+publisher pairs by avgRating quickly from pre-aggregated data
// db.designer_game.createIndex({ designer: 1, publisher: 1 })
//   - helps during migration and any direct queries on designer_game mapping
// db.games_metrics.createIndex({ NumUserRatings: -1 })
//   - helps filtering games by NumUserRatings during migration

const pipeline = [
  // Filter games early so we don't process all designer docs
  { $match: { NumUserRatings: { $gte: MIN_USER_RATINGS } } },
  { $project: { BGGId: 1, Publisher: 1, AvgRating: 1, BayesAvgRating: 1, NumOwned: 1, NumUserRatings: 1 } },
  // Lookup the designers_reduced_clean document for each game
  { $lookup: { from: 'designers_reduced_clean', localField: 'BGGId', foreignField: 'BGGId', as: 'dr' } },
  { $unwind: '$dr' },
  // Turn the designers doc into key/value pairs and unwind to get one row per designer per game
  { $project: { BGGId:1, Publisher:1, AvgRating:1, BayesAvgRating:1, NumOwned:1, NumUserRatings:1, arr: { $objectToArray: '$dr' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.k': { $ne: '_id' }, 'arr.k': { $ne: 'BGGId' }, 'arr.k': { $ne: 'Low_Exp_Designer' }, 'arr.v': 1 } },
  { $group: {
      _id: { designer: '$arr.k', publisher: '$Publisher' },
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' },
      totalNumUserRatings: { $sum: '$NumUserRatings' }
  } },
  { $sort: { avgRating: -1, gamesCount: -1 } }
];

// Use pre-aggregated designer_publisher_agg to return results quickly
const pairs = db.designer_publisher_agg.find({}, { projection: { avgRating:1, avgBayes:1, gamesCount:1, totalNumOwned:1 } }).sort({ avgRating: -1 }).toArray();
const top3ByRating = pairs.slice(0,3);
const top3ByOwned = pairs.slice().sort((a,b)=> b.totalNumOwned - a.totalNumOwned).slice(0,3);

printjson({ label: 'avg_rating_by_designer_publisher_post', totalPairs: pairs.length, top3ByRating, top3ByOwned });
