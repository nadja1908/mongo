// scripts/run_sample_queries.js
// Run a couple of quick queries against the mongo_database to inspect data.

const d = db.getSiblingDB('mongo_database');

print('--- one document from games_clean ---');
printjson(d.getCollection('games_clean').findOne());

print('\n--- top games by average rating (sample, min 10 ratings) ---');
const top = d.getCollection('user_ratings_sample1M').aggregate([
  { $group: { _id: "$game_id", avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  { $match: { n: { $gte: 10 } } },
  { $sort: { avg: -1 } },
  { $limit: 10 }
]).toArray();
printjson(top);
