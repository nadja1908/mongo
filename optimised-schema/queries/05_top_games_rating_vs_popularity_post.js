// Post-optimized: best rated vs most popular (post-indexed)
const db = db.getSiblingDB('mongo_database');

const games = db.games_clean.find({}, { BGGId:1, Name:1, BayesAvgRating:1, AvgRating:1, NumOwned:1 }).toArray();
const byBayes = [...games].sort((a,b)=> (b.BayesAvgRating||0) - (a.BayesAvgRating||0));
const byOwned = [...games].sort((a,b)=> (b.NumOwned||0) - (a.NumOwned||0));
const bayesRank = new Map(); byBayes.forEach((g,i)=> bayesRank.set(g.BGGId, i+1));
const ownedRank = new Map(); byOwned.forEach((g,i)=> ownedRank.set(g.BGGId, i+1));
const ranked = games.map(g => ({ BGGId: g.BGGId, Name: g.Name, BayesRank: bayesRank.get(g.BGGId), OwnedRank: ownedRank.get(g.BGGId), delta: (ownedRank.get(g.BGGId) || 0) - (bayesRank.get(g.BGGId) || 0), BayesAvgRating: g.BayesAvgRating, NumOwned: g.NumOwned }));

const ownedVals = games.map(g=>g.NumOwned||0).sort((a,b)=>a-b);
const owned25 = ownedVals[Math.floor(ownedVals.length*0.25)||0] || 0;
const hiddenGems = ranked.filter(r=> r.BayesAvgRating!=null && r.NumOwned <= owned25).sort((a,b)=> b.BayesAvgRating - a.BayesAvgRating).slice(0,3);
const bayesMedian = (()=>{ const vals = games.map(g=>g.BayesAvgRating||0).sort((a,b)=>a-b); return vals[Math.floor(vals.length/2)||0]||0; })();
const hype = ranked.filter(r=> r.NumOwned > ownedVals[Math.floor(ownedVals.length*0.75)||0] && (r.BayesAvgRating || 0) < bayesMedian).slice(0,3);
const highBoth = ranked.filter(r=> r.NumOwned > ownedVals[Math.floor(ownedVals.length*0.5)||0] && (r.BayesAvgRating||0) > bayesMedian).sort((a,b)=> b.BayesAvgRating - a.BayesAvgRating).slice(0,3);

const rd = db.ratings_distribution_clean ? db.ratings_distribution_clean.find().toArray() : db.getSiblingDB('mongo_database').ratings_distribution_clean.find().toArray();
let highRatings = 0, total = 0;
if (rd && rd.length) {
  rd.forEach(bin => { if (typeof bin.bin === 'string' && bin.bin.startsWith('8')) { highRatings += bin.count; } else if (bin.bin && Number(bin.bin) >= 8) { highRatings += bin.count; } total += (bin.count||0); });
}
const pctHighRatings = total? (highRatings/total)*100 : null;

printjson({ label: 'top_games_rating_vs_popularity_post', hiddenGems, hype, highBoth, pctHighRatings });
