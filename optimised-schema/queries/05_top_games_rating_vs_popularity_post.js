// Post-optimized: best rated vs most popular (server-side where possible)
// Replace client-side full toArray + sort with server-side find/sort/limit and small aggregations.
//
// Indexes used by this POST implementation (run these after migration):
// db.games_metrics.createIndex({ BayesAvgRating: -1 })
//   - helps: top-N by BayesAvgRating
// db.games_metrics.createIndex({ NumOwned: -1 })
//   - helps: top-N by NumOwned (popularity)
// db.ratings_distribution_clean.createIndex({ bin: 1 })
//   - helps: fast read of rating distribution bins for percentage computations
const db = db.getSiblingDB('mongo_database');

// Top N constants
const TOP_N = 3;

// Use indexed server-side sorts to get top N quickly. Use the derived `games_metrics` collection
// (lighter, pre-projected) so the indexed sorts are smaller and faster.
const topByBayes = db.games_metrics.find({}, { BGGId:1, Name:1, BayesAvgRating:1, NumOwned:1 }).sort({ BayesAvgRating: -1 }).limit(TOP_N).toArray();
const topByOwned = db.games_metrics.find({}, { BGGId:1, Name:1, BayesAvgRating:1, NumOwned:1 }).sort({ NumOwned: -1 }).limit(TOP_N).toArray();

// For delta-based ranking we can compute ranks for top candidates only (cheap). If a full ranking is necessary,
// consider $setWindowFields and $merge to a temp collection (more expensive but server-side).

// Compute high-rating percentage from distribution (keeps server-side read small)
const rdCursor = db.ratings_distribution_clean.find();
let highRatings = 0, total = 0;
while (rdCursor.hasNext()) {
  const bin = rdCursor.next();
  if (typeof bin.bin === 'string' && bin.bin.startsWith('8')) { highRatings += bin.count || 0; }
  else if (bin.bin && Number(bin.bin) >= 8) { highRatings += bin.count || 0; }
  total += (bin.count||0);
}
const pctHighRatings = total ? (highRatings/total)*100 : null;

printjson({ label: 'top_games_rating_vs_popularity_post', topByBayes, topByOwned, pctHighRatings });

// Expose a representative pipeline for explain tooling. The script uses server-side
// find/sort/limit to get top-N; for explain() we provide a similar aggregation that
// sorts by BayesAvgRating and limits to TOP_N so the explain output is meaningful.
var pipeline = [
  { $project: { BGGId:1, Name:1, BayesAvgRating:1, NumOwned:1 } },
  { $sort: { BayesAvgRating: -1 } },
  { $limit: TOP_N }
];
