// Post-optimized: games with most distinct themes (uses index-friendly lookups)
const db = db.getSiblingDB('mongo_database');

// Use derived collection `games_metrics` which contains a `themes` array per game
//
// Indexes used by this POST implementation (run these after migration):
// db.games_metrics.createIndex({ YearPublished: 1 })           // if you filter by year in other variants
// db.games_metrics.createIndex({ AvgRating: -1 })              // helps sorting/filtering by rating
// db.games_metrics.createIndex({ themes: 1 })                  // supports existence/array queries on themes
// db.games_metrics.createIndex({ BGGId: 1 })                   // supports lookups / reinflation
const pipeline = [
  { $project: { BGGId:1, themeCount: { $size: { $ifNull: ['$themes', []] } }, AvgRating:1, NumOwned:1 } },
  { $sort: { themeCount: -1 } }
];

const arr = db.games_metrics.aggregate(pipeline).toArray();
const top3 = arr.slice(0,3);
const bottom3 = arr.slice(-3);
const total = arr.length;
const moreThan10 = arr.filter(a => a.themeCount > 10).length;
const pctMoreThan10 = total? (moreThan10/total)*100 : 0;

// buckets
const buckets = { '0-5': [], '6-10': [], '>10': [] };
arr.forEach(g => {
  const bucket = g.themeCount <=5 ? '0-5' : (g.themeCount <=10 ? '6-10' : '>10');
  if (g.AvgRating != null) buckets[bucket].push(g.AvgRating);
});
const avg = a => a.length? a.reduce((s,x)=>s+x,0)/a.length : null;
const bucketAvgs = { '0-5': avg(buckets['0-5']), '6-10': avg(buckets['6-10']), '>10': avg(buckets['>10']) };
const allRatings = arr.map(a=>a.AvgRating).filter(r=>r!=null).sort((x,y)=>x-y);
const cutoffIdx = Math.max(0, Math.floor(allRatings.length*0.95));
const highRatingCutoff = allRatings.length? allRatings[cutoffIdx] : null;
const lowThemeHighRating = arr.sort((a,b)=>a.themeCount - b.themeCount).filter(g => g.AvgRating != null && g.AvgRating >= (highRatingCutoff || 0)).slice(0,3);

printjson({ label: 'games_most_distinct_themes_post', totalGames: total, pctMoreThan10, top3, bottom3, bucketAvgs, lowThemeHighRating });
