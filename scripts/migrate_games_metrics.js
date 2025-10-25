// migrate_games_metrics.js
// Build a lightweight games_metrics collection from games_clean
const db = db.getSiblingDB('mongo_database');

print('Starting games_metrics migration...');

db.games_metrics.drop();
db.games_metrics.createIndex({ BGGId: 1 }, { unique: true });

db.games_clean.aggregate([
  { $project: {
      BGGId: 1,
      Name: 1,
      AvgRating: 1,
      BayesAvgRating: 1,
      NumOwned: 1,
      NumUserRatings: 1,
      YearPublished: 1,
      mechanics: 1,
      themes: 1,
      designers: 1,
      Publisher: 1
  }},
  { $merge: { into: 'games_metrics', whenMatched: 'replace', whenNotMatched: 'insert' } }
], { allowDiskUse: true });

print('games_metrics migration done.');
