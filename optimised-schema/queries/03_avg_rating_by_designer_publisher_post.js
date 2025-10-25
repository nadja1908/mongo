// Post-optimized: avg rating by designer-publisher (with threshold filter)
const db = db.getSiblingDB('mongo_database');

const pipeline = [
  { $project: { BGGId:1, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.k': { $ne: '_id' }, 'arr.k': { $ne: 'BGGId' }, 'arr.k': { $ne: 'Low_Exp_Designer' }, 'arr.v': 1 } },
  { $lookup: { from: 'games_clean', localField: 'BGGId', foreignField: 'BGGId', as: 'game' } },
  { $unwind: '$game' },
  { $group: {
      _id: { designer: '$arr.k', publisher: '$game.Publisher' },
      avgRating: { $avg: '$game.AvgRating' },
      avgBayes: { $avg: '$game.BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$game.NumOwned' },
      totalNumUserRatings: { $sum: '$game.NumUserRatings' }
  } },
  { $match: { totalNumUserRatings: { $gte: 500 } } },
  { $sort: { avgRating: -1 } }
];

const pairs = db.designers_reduced_clean.aggregate(pipeline).toArray();
const top3ByRating = pairs.slice(0,3);
const top3ByOwned = pairs.sort((a,b)=>b.totalNumOwned - a.totalNumOwned).slice(0,3);

printjson({ label: 'avg_rating_by_designer_publisher_post', totalPairs: pairs.length, top3ByRating, top3ByOwned });
