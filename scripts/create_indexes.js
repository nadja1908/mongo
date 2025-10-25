// create_indexes.js
// Run this in mongosh to create recommended indexes used by the optimized queries.
// Usage (PowerShell + docker example):
// docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
//   mongosh --host host.docker.internal --port 27018 /workspace/scripts/create_indexes.js

const db = db.getSiblingDB('mongo_database');

print('Creating recommended indexes...');

const ops = [
  { coll: 'games_clean', spec: { BGGId: 1 }, opts: { } },
  { coll: 'games_clean', spec: { AvgRating: -1 }, opts: { } },
  { coll: 'games_clean', spec: { NumOwned: -1 }, opts: { } },
  { coll: 'games_clean', spec: { YearPublished: 1 }, opts: { } },
  { coll: 'games_clean', spec: { BayesAvgRating: -1 }, opts: { } },
  { coll: 'games_clean', spec: { Publisher: 1 }, opts: { } },
  { coll: 'themes_clean', spec: { BGGId: 1 }, opts: { } },
  { coll: 'ratings_distribution_clean', spec: { bin: 1 }, opts: { } },
  // Derived collections
  { coll: 'games_metrics', spec: { BGGId: 1 }, opts: { } },
  { coll: 'games_metrics', spec: { BayesAvgRating: -1 }, opts: { } },
  { coll: 'games_metrics', spec: { NumOwned: -1 }, opts: { } },
  { coll: 'games_metrics', spec: { AvgRating: -1 }, opts: { } },
  { coll: 'games_metrics', spec: { YearPublished: 1, AvgRating: -1 }, opts: { } },
  { coll: 'games_metrics', spec: { YearPublished: 1, NumOwned: -1 }, opts: { } },
  { coll: 'games_metrics', spec: { mechanics: 1 }, opts: { } },
  { coll: 'mechanic_to_games', spec: { mechanic: 1, AvgRating: -1 }, opts: { } },
  { coll: 'mechanic_to_games', spec: { BGGId: 1 }, opts: { } },
  { coll: 'designer_game', spec: { designer: 1, publisher: 1 }, opts: { } },
  { coll: 'designer_game', spec: { BGGId: 1 }, opts: { } },
  { coll: 'designer_publisher_agg', spec: { '_id.designer': 1, '_id.publisher': 1 }, opts: { } },
  { coll: 'designer_publisher_agg', spec: { avgRating: -1 }, opts: { } },
  // If you have designers_reduced_clean with frequent lookups, ensure games_clean.BGGId exists (already above)
];

for (const op of ops) {
  try {
    // tojson may not be available in some shells; use JSON.stringify for portability
    print(`Creating index on ${op.coll}: ${JSON.stringify(op.spec)}`);
    const res = db.getCollection(op.coll).createIndex(op.spec, op.opts);
    print(` -> ${res}`);
  } catch (e) {
    print(`Error creating index on ${op.coll}: ${e}`);
  }
}

print('Done. Run your optimized queries after indexes are created.');
