// Pre-optimized: games with most distinct themes
const db = db.getSiblingDB('mongo_database');

// Count active themes per game
const themesPerGame = [
  { $project: { BGGId:1, arr: { $objectToArray: '$$ROOT' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.k': { $ne: '_id' }, 'arr.k': { $ne: 'BGGId' }, 'arr.v': 1 } },
  { $group: { _id: '$BGGId', themeCount: { $sum: 1 } } },
  { $lookup: { from: 'games_clean', localField: '_id', foreignField: 'BGGId', as: 'game' } },
  { $unwind: { path: '$game', preserveNullAndEmptyArrays: true } },
  { $project: { _id:1, themeCount:1, AvgRating: '$game.AvgRating', NumOwned: '$game.NumOwned' } },
  { $sort: { themeCount: -1 } }
];

const arr = db.themes_clean.aggregate(themesPerGame).toArray();
const top3 = arr.slice(0,3);
const bottom3 = arr.slice(-3);

// Percentage with >10 themes
const total = arr.length;
const moreThan10 = arr.filter(a => a.themeCount > 10).length;
const pctMoreThan10 = total? (moreThan10/total)*100 : 0;

// Rating by buckets (0-5,6-10,>10)
const buckets = { '0-5': [], '6-10': [], '>10': [] };
arr.forEach(g => {
  const bucket = g.themeCount <=5 ? '0-5' : (g.themeCount <=10 ? '6-10' : '>10');
  if (g.AvgRating != null) buckets[bucket].push(g.AvgRating);
});
const avg = a => a.length? a.reduce((s,x)=>s+x,0)/a.length : null;

const bucketAvgs = { '0-5': avg(buckets['0-5']), '6-10': avg(buckets['6-10']), '>10': avg(buckets['>10']) };

// Three games with lowest number of themes but high ratings (threshold: top 5% rating)
const allRatings = arr.map(a=>a.AvgRating).filter(r=>r!=null).sort((x,y)=>x-y);
const cutoffIdx = Math.max(0, Math.floor(allRatings.length*0.95));
const highRatingCutoff = allRatings.length? allRatings[cutoffIdx] : null;
const lowThemeHighRating = arr.sort((a,b)=>a.themeCount - b.themeCount).filter(g => g.AvgRating != null && g.AvgRating >= (highRatingCutoff || 0)).slice(0,3);

printjson({ label: 'games_most_distinct_themes_pre', totalGames: total, pctMoreThan10, top3, bottom3, bucketAvgs, lowThemeHighRating });
