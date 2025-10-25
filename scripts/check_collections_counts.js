// check_collections_counts.js
// Prints counts for games_clean and games_metrics and reports any BGGIds in games_clean
// that are missing from games_metrics (should be zero after migration).
const db = db.getSiblingDB('mongo_database');

print('games_clean count:', db.games_clean.countDocuments());
print('games_metrics count:', db.games_metrics.countDocuments());

// compute number of BGGIds in games_clean missing from games_metrics
// use aggregation to avoid pulling big distinct arrays into client memory
const missing = db.games_clean.aggregate([
  { $match: { BGGId: { $exists: true } } },
  { $lookup: { from: 'games_metrics', localField: 'BGGId', foreignField: 'BGGId', as: 'm' } },
  { $match: { m: { $size: 0 } } },
  { $count: 'missing' }
]).toArray();

print('BGGIds in games_clean missing from games_metrics:', (missing[0] && missing[0].missing) || 0);

// Optionally print a small sample of missing BGGIds
const sample = db.games_clean.aggregate([
  { $match: { BGGId: { $exists: true } } },
  { $lookup: { from: 'games_metrics', localField: 'BGGId', foreignField: 'BGGId', as: 'm' } },
  { $match: { m: { $size: 0 } } },
  { $limit: 10 },
  { $project: { BGGId: 1, Name: 1 } }
]).toArray();

print('Sample missing (up to 10):', JSON.stringify(sample));
