// migrate_mechanic_to_games.js
// Build mechanic_to_games mapping by joining mechanics_clean to games_metrics
const db = db.getSiblingDB('mongo_database');

print('Starting mechanic_to_games migration...');

db.mechanic_to_games.drop();

db.mechanics_clean.aggregate([
  { $project: { BGGId:1, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.k': { $ne: '_id' }, 'arr.k': { $ne: 'BGGId' }, 'arr.v': 1 } },
  { $project: { mechanic: '$arr.k', BGGId: 1 } },
  { $lookup: { from: 'games_metrics', localField: 'BGGId', foreignField: 'BGGId', as: 'game' } },
  { $unwind: '$game' },
  { $project: { mechanic: 1, BGGId:1, AvgRating: '$game.AvgRating', BayesAvgRating: '$game.BayesAvgRating', NumOwned: '$game.NumOwned' } },
  { $merge: { into: 'mechanic_to_games', whenMatched: 'replace', whenNotMatched: 'insert' } }
], { allowDiskUse: true });

db.mechanic_to_games.createIndex({ mechanic: 1, AvgRating: -1 });
db.mechanic_to_games.createIndex({ BGGId: 1 });

print('mechanic_to_games migration done.');
