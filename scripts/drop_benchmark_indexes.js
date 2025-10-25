// drop_benchmark_indexes.js
// Drop indexes created for benchmarking so we can run baseline (no-index) measurements.
const db = db.getSiblingDB('mongo_database');

print('Dropping benchmark indexes (leaving _id)...');

const drops = [
  { coll: 'games_clean', spec: { AvgRating: -1 } },
  { coll: 'games_clean', spec: { NumOwned: -1 } },
  { coll: 'games_clean', spec: { YearPublished: 1 } },
  { coll: 'games_clean', spec: { BayesAvgRating: -1 } },
  { coll: 'games_clean', spec: { Publisher: 1 } },
  { coll: 'themes_clean', spec: { BGGId: 1 } },
  { coll: 'ratings_distribution_clean', spec: { bin: 1 } },
  { coll: 'games_metrics', spec: { BayesAvgRating: -1 } },
  { coll: 'games_metrics', spec: { NumOwned: -1 } },
  { coll: 'games_metrics', spec: { AvgRating: -1 } },
  { coll: 'games_metrics', spec: { YearPublished: 1 } },
  { coll: 'games_metrics', spec: { mechanics: 1 } },
  { coll: 'mechanic_to_games', spec: { mechanic: 1, AvgRating: -1 } },
  { coll: 'mechanic_to_games', spec: { BGGId: 1 } },
  { coll: 'designer_game', spec: { designer: 1, publisher: 1 } },
  { coll: 'designer_game', spec: { BGGId: 1 } },
  { coll: 'designer_publisher_agg', spec: { '_id.designer': 1, '_id.publisher': 1 } },
  { coll: 'designer_publisher_agg', spec: { avgRating: -1 } }
];

for (const d of drops) {
  try {
    print(`Dropping index on ${d.coll}: ${JSON.stringify(d.spec)}`);
    db.getCollection(d.coll).dropIndex(d.spec);
    print(' -> dropped');
  } catch (e) {
    print(` -> could not drop (maybe not present): ${e}`);
  }
}

print('Done dropping benchmark indexes.');
