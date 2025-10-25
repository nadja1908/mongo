// migrate_designer_game.js
// Normalize designers_reduced_clean into designer_game mapping using games_metrics
const db = db.getSiblingDB('mongo_database');

print('Starting designer_game migration...');

db.designer_game.drop();

db.designers_reduced_clean.aggregate([
  { $project: { BGGId: 1, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.k': { $ne: '_id' }, 'arr.k': { $ne: 'BGGId' }, 'arr.k': { $ne: 'Low_Exp_Designer' }, 'arr.v': 1 } },
  { $project: { designer: '$arr.k', BGGId: 1 } },
  { $lookup: { from: 'games_metrics', localField: 'BGGId', foreignField: 'BGGId', as: 'game' } },
  { $unwind: '$game' },
  { $project: {
      designer: 1,
      BGGId: 1,
      publisher: '$game.Publisher',
      AvgRating: '$game.AvgRating',
      BayesAvgRating: '$game.BayesAvgRating',
      NumOwned: '$game.NumOwned',
      NumUserRatings: '$game.NumUserRatings'
  } },
  { $merge: { into: 'designer_game', whenMatched: 'replace', whenNotMatched: 'insert' } }
], { allowDiskUse: true });

db.designer_game.createIndex({ designer: 1, publisher: 1 });
db.designer_game.createIndex({ BGGId: 1 });

print('designer_game migration done.');
