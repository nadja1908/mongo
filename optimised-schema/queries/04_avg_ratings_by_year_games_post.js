// Post-optimized: average ratings by year, plus best and most owned per year
const db = db.getSiblingDB('mongo_database');

const statsPipeline = [
  { $match: { YearPublished: { $exists: true, $ne: null } } },
  { $group: {
      _id: '$YearPublished',
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' }
  } },
  { $sort: { _id: 1 } }
];

const yearStats = db.games_clean.aggregate(statsPipeline).toArray();
const sortedByRating = [...yearStats].sort((a,b)=>b.avgRating - a.avgRating);
const top3Years = sortedByRating.slice(0,3);
const bottom3Years = sortedByRating.slice(-3).reverse();

const yearDetails = yearStats.map(y => {
  const yearVal = y._id;
  const bestGame = db.games_clean.find({ YearPublished: yearVal }, { projection: { BGGId:1, Name:1, AvgRating:1 } }).sort({ AvgRating: -1 }).limit(1).toArray()[0] || null;
  const mostOwned = db.games_clean.find({ YearPublished: yearVal }, { projection: { BGGId:1, Name:1, NumOwned:1 } }).sort({ NumOwned: -1 }).limit(1).toArray()[0] || null;
  return { year: yearVal, avgRating: y.avgRating, avgBayes: y.avgBayes, gamesCount: y.gamesCount, totalNumOwned: y.totalNumOwned, bestGame, mostOwned };
});

printjson({ label: 'avg_ratings_by_year_games_post', yearStatsCount: yearStats.length, top3Years, bottom3Years, yearDetails });
