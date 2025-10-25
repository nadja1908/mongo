// migrate_designer_publisher_agg.js
// Aggregate designer_game into designer_publisher_agg (pre-aggregated results)
const db = db.getSiblingDB('mongo_database');

print('Starting designer_publisher_agg migration...');

db.designer_publisher_agg.drop();

db.designer_game.aggregate([
  { $group: {
      _id: { designer: '$designer', publisher: '$publisher' },
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' },
      totalNumUserRatings: { $sum: '$NumUserRatings' }
  } },
  { $match: { totalNumUserRatings: { $gte: 500 } } },
  { $sort: { avgRating: -1 } },
  { $merge: { into: 'designer_publisher_agg', whenMatched: 'replace', whenNotMatched: 'insert' } }
], { allowDiskUse: true });

db.designer_publisher_agg.createIndex({ '_id.designer': 1, '_id.publisher': 1 });
db.designer_publisher_agg.createIndex({ avgRating: -1 });

print('designer_publisher_agg migration done.');
