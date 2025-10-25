## Optimised schema — pregled promena i rezultata benchmarka

Ovaj README ukratko objašnjava šta je urađeno u `optimised-schema` grani: koje kolekcije/izvedene kolekcije su dodate, koje indekse smo napravili za potrebe optimizacije, koje upite smo prepravili i kako su se performanse promenile u PRE vs POST benchmarkima.

Napomena: originalni harness pokreće PRE (baseline bez benchmark indeksa / izvedenih kolekcija) i POST (posle migracija i kreiranja indeksa). Vrednosti predstavljene niže su medijane iz 3 pokretanja (`bench_results/timing_summary.json`).

### Ključne promene

- Dodate izvedene kolekcije (migracije):
  - `games_metrics` — agregirani metrički podaci za igru (AvgRating, NumOwned, YearPublished, ...)
  - `mechanic_to_games`, `designer_game`, `designer_publisher_agg` — pomoćne mape/aglomerati za brže upite koji traže agregate po mehanici, dizajneru, izdavaču.

- Indeksi kreirani (najvažniji):
  - `games_metrics`: { YearPublished: 1, AvgRating: -1 }
  - `games_metrics`: { YearPublished: 1, NumOwned: -1 }
  - Dodato i nekoliko indeksa na izvorne kolekcije i izvedenim kolekcijama za podršku brzih $lookup/merge operacija; detalji se nalaze u `scripts/create_indexes.js`.

### Upiti (pregled)

- 01_mechanics_popular_by_avg_gt8 — precompute / agregacija po mehanikama za igre sa AvgRating > 8
- 02_games_most_distinct_themes — maksimalan broj različitih tema po igri (pre-aggregated)
- 03_avg_rating_by_designer_publisher — agregat po dizajner/izdavač parovima
- 04_avg_ratings_by_year_games — prosečne ocene po godini + za svaku godinu prikaz najboljih i najviše posedovanih igara (ovo je bio fokusna tačka optimizacije: izbegnuta N+1 logika i portovana u server-side $lookup pipeline koristeći `games_metrics`)
- 05_top_games_rating_vs_popularity — komparativni upit rating vs popularity (ostao relativno skuplji; moguće dalje optimizacije)

### Rezultati benchmarka (PRE vs POST)

Izvuci iz `bench_results/timing_summary.json` (medijane iz 3 pokretanja):

| Skripta | PRE median (ms) | POST median (ms) | Brzina (x) |
|---|---:|---:|---:|
| 01_mechanics_popular_by_avg_gt8 | 19,516 | 193 | ~101× faster |
| 02_games_most_distinct_themes | 8,063 | 2,649 | ~3.0× faster |
| 03_avg_rating_by_designer_publisher | 71,216 | 107 | ~666× faster |
| 04_avg_ratings_by_year_games | 1,697 | 463 | ~3.7× faster |
| 05_top_games_rating_vs_popularity | 10,719 | 9,284 | ~1.2× faster |

Komentari:
- Najveća dobit je na upitima gde smo izradili odgovarajuće izvedene podatke (`games_metrics`) i/ili izbegli N+1 pozive tako što smo premestili rad na server u obliku jednog agregacionog pipeline-a sa $lookup. Primer: `04_avg_ratings_by_year_games` je prepravljen da radi jednu agregaciju nad `games_metrics` koja koristi $lookup pipeline da dohvati „bestGame“ i „mostOwned“ po godini — to je smanjilo latenciju sa ~1.7s na ~0.46s (medijan iz 3 pokretanja).

- Upit `03_avg_rating_by_designer_publisher` je postao ekstremno brži jer je prekomponovan da koristi izvedene agregate (ili indekse) umesto skeniranja velikih dokumenata u klijentu.

- `05_top_games_rating_vs_popularity` je poboljšan ali je još uvek relativno skup; moguće dalje optimizacije:
  - dodavanje kompozitnih indeksa relevantnih za sort/paginate kolone
  - pre-ugradnja agregata za „top N“ grupe

### Kako reproducirati (kratko)

1. Obriši benchmark indekse i uradi PRE run (baseline):

   docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
     mongosh --host host.docker.internal --port 27018 /workspace/scripts/run_pre_only_with_time.js \
     > .\bench_results\pre_run_1.json

2. Pokreni migracije i kreiraj indekse:

   docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
     mongosh --host host.docker.internal --port 27018 /workspace/scripts/run_migrations.js

   docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
     mongosh --host host.docker.internal --port 27018 /workspace/scripts/create_indexes.js

3. Pokreni POST run:

   docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
     mongosh --host host.docker.internal --port 27018 /workspace/scripts/run_post_only_with_time.js \
     > .\bench_results\post_run_1.json

4. Skupljanje i sumarizacija vremena (lokalno Python skriptama):

   python .\scripts\collect_timings.py --in .\bench_results\pre_run_1.json --in .\bench_results\post_run_1.json --out .\bench_results\prepost_runs_with_time.jsonl
   python .\scripts\compute_timings_jsonl.py .\bench_results\prepost_runs_with_time.jsonl

### Dalji koraci i preporuke

- Ako želiš potpuni, bit-for-bit PRE vs POST JSON diff za `04_avg_ratings_by_year_games`, preporučujem da privremeno ispišeš rezultat kao JSON (npr. `console.log(JSON.stringify(result))`) u `optimised-schema/queries/04_avg_ratings_by_year_games_post.js` i ponovo pokreneš POST harness — to olakšava parsiranje i poređenje. Implemenitrano je i `scripts/diff_04_pre_post.py` koji pokušava to automatizovati, ali parsing mongosh-printed JS objekata je ponekad krhak.

- Za upit `05` možeš razmotriti dodatne indekse ili izradu izvedenih tabela za top-N poređenja.

---

Ako želiš, mogu:
- A) Privremeno izmeniti `04_avg_ratings_by_year_games_post.js` da koristi JSON.stringify za čist output i ponovo pokrenuti POST harness + diff.
- B) Generisati detaljniji README koji uključuje full explain() izveštaje i linkove na fajlove u `bench_results/explains_post/`.

Reci šta želiš dalje i odradiću to.

## Metrike koje smo koristili i potpuni POST upiti

Donje sekcije navode tačno koje su metrike (polja) iz `games_metrics` i povezanih izvedenih kolekcija korišćene za optimizovane upite, i zatim uključuju pune tekstove POST skripti koje su pokretane u harnessu.

### Polja / metričke kolone u `games_metrics`

- `BGGId` (identifikator igre)
- `Name` (naziv igre)
- `AvgRating` (prosečna ocena korisnika)
- `BayesAvgRating` (Bayes-izravnata prosečna ocena)
- `NumOwned` (koliko korisnika poseduje igru)
- `NumUserRatings` (broj korisničkih ocena)
- `YearPublished` (godina izdanja)
- `mechanics` (niz mehanika)
- `themes` (niz tema)
- `designers` (niz dizajnera)
- `Publisher` (izdavač)

Ova kolekcija se gradi u `scripts/migrate_games_metrics.js` iz `games_clean` i sadrži samo polja koja su nam potrebna za indeksiranje i brze server-side operacije.

### Koja metrika je korišćena u kom upitu

- 01_mechanics_popular_by_avg_gt8: AvgRating, BayesAvgRating, NumOwned, mechanics
- 02_games_most_distinct_themes: themes, AvgRating, NumOwned
- 03_avg_rating_by_designer_publisher: AvgRating, BayesAvgRating, NumOwned, NumUserRatings, Publisher, designers (putem `designer_publisher_agg`)
- 04_avg_ratings_by_year_games: YearPublished, AvgRating, BayesAvgRating, NumOwned
- 05_top_games_rating_vs_popularity: BayesAvgRating, NumOwned, ratings_distribution_clean (bins)

### Puni tekstovi optimizovanih POST upita

01_mechanics_popular_by_avg_gt8_post.js

```javascript
// Post-optimized (index-friendly): mechanics_popular_by_avg_gt8
// This version uses the derived collection `mechanic_to_games` so we avoid scanning
// `mechanics_clean` and can use indexes on the derived collection.
//
// Indexes used by this POST implementation (run these after migration):
// db.mechanic_to_games.createIndex({ mechanic: 1, AvgRating: -1 })
//   - helps: filter by AvgRating and retrieve top games per mechanic efficiently
// db.mechanic_to_games.createIndex({ BGGId: 1 })
//   - helps: joins/lookups during migration and any reinflation by BGGId
// db.games_metrics.createIndex({ AvgRating: -1 })
//   - used during migration and useful as a fallback on game-side queries
const db = db.getSiblingDB('mongo_database');

// Use derived collection `mechanic_to_games` (pre-computed mapping) so we avoid scanning mechanics_clean
const pipeline = [
  // Filter games by AvgRating on the derived mapping
  { $match: { AvgRating: { $gt: 8 } } },
  { $group: {
      _id: '$mechanic',
      countGames: { $sum: 1 },
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      sumNumOwned: { $sum: '$NumOwned' },
      stddevRating: { $stdDevSamp: '$AvgRating' }
  } },
  { $sort: { countGames: -1 } }
];

const cursor = db.mechanic_to_games.aggregate(pipeline, { allowDiskUse: true });
const results = cursor.toArray();

const top3 = results.slice(0,3);
const filteredByAvg = results.filter(r => r.avgRating > 8).sort((a,b) => b.avgRating - a.avgRating);
const bottom3 = filteredByAvg.slice(-3).reverse();

const overallAvgStd = results.reduce((s, r) => s + (r.stddevRating || 0), 0) / (results.length || 1);
const top10 = results.slice(0, 10);
const top10AvgStd = top10.reduce((s, r) => s + (r.stddevRating || 0), 0) / (top10.length || 1);

printjson({ label: 'mechanics_popular_by_avg_gt8_post', totalMechanics: results.length, top3, bottom3, overallAvgStd, top10AvgStd });
```

02_games_most_distinct_themes_post.js

```javascript
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
```

03_avg_rating_by_designer_publisher_post.js

```javascript
// Post-optimized: avg rating by designer-publisher (inverted pipeline)
// Strategy: start from games_clean (filtering early), then lookup into designers_reduced_clean
// so we can apply game-side filters (NumUserRatings >= threshold) and use game-side indexes.
const db = db.getSiblingDB('mongo_database');

// Threshold used by the original pipeline's post-match
const MIN_USER_RATINGS = 500;

// Indexes used by this POST implementation (run these after migration):
// db.designer_publisher_agg.createIndex({ avgRating: -1 })
//   - helps: returning top designer+publisher pairs by avgRating quickly from pre-aggregated data
// db.designer_game.createIndex({ designer: 1, publisher: 1 })
//   - helps during migration and any direct queries on designer_game mapping
// db.games_metrics.createIndex({ NumUserRatings: -1 })
//   - helps filtering games by NumUserRatings during migration

const pipeline = [
  // Filter games early so we don't process all designer docs
  { $match: { NumUserRatings: { $gte: MIN_USER_RATINGS } } },
  { $project: { BGGId: 1, Publisher: 1, AvgRating: 1, BayesAvgRating: 1, NumOwned: 1, NumUserRatings: 1 } },
  // Lookup the designers_reduced_clean document for each game
  { $lookup: { from: 'designers_reduced_clean', localField: 'BGGId', foreignField: 'BGGId', as: 'dr' } },
  { $unwind: '$dr' },
  // Turn the designers doc into key/value pairs and unwind to get one row per designer per game
  { $project: { BGGId:1, Publisher:1, AvgRating:1, BayesAvgRating:1, NumOwned:1, NumUserRatings:1, arr: { $objectToArray: '$dr' } } },
  { $unwind: '$arr' },
  { $match: { 'arr.k': { $ne: '_id' }, 'arr.k': { $ne: 'BGGId' }, 'arr.k': { $ne: 'Low_Exp_Designer' }, 'arr.v': 1 } },
  { $group: {
      _id: { designer: '$arr.k', publisher: '$Publisher' },
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' },
      totalNumUserRatings: { $sum: '$NumUserRatings' }
  } },
  { $sort: { avgRating: -1, gamesCount: -1 } }
];

// Use pre-aggregated designer_publisher_agg to return results quickly
const pairs = db.designer_publisher_agg.find({}, { projection: { avgRating:1, avgBayes:1, gamesCount:1, totalNumOwned:1 } }).sort({ avgRating: -1 }).toArray();
const top3ByRating = pairs.slice(0,3);
const top3ByOwned = pairs.slice().sort((a,b)=> b.totalNumOwned - a.totalNumOwned).slice(0,3);

printjson({ label: 'avg_rating_by_designer_publisher_post', totalPairs: pairs.length, top3ByRating, top3ByOwned });
```

04_avg_ratings_by_year_games_post.js

```javascript
// Post-optimized: average ratings by year, plus best and most owned per year
const db = db.getSiblingDB('mongo_database');

// Ensure indexes exist for the per-year top/most queries. Some environments create
// indexes centrally, but we make these idempotent so running this script alone
// still ensures good POST performance for this query.
try {
  print('Ensuring index: games_metrics { YearPublished:1, AvgRating:-1 }');
  db.games_metrics.createIndex({ YearPublished: 1, AvgRating: -1 });
} catch (e) {
  print('Index creation (YearPublished,AvgRating) error: ' + e);
}
try {
  print('Ensuring index: games_metrics { YearPublished:1, NumOwned:-1 }');
  db.games_metrics.createIndex({ YearPublished: 1, NumOwned: -1 });
} catch (e) {
  print('Index creation (YearPublished,NumOwned) error: ' + e);
}

// Indexes used by this POST implementation (run these after migration):
// db.games_metrics.createIndex({ YearPublished: 1, AvgRating: -1 })
//   - helps: compute year-level aggregates and find top games per year efficiently
// db.games_metrics.createIndex({ AvgRating: -1 })
//   - helps: sorting by rating across queries
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

// Server-side pipeline that computes year stats and, for each year, looks up
// the best-rated and most-owned game using indexed pipeline lookups. This
// avoids N+1 client-side finds and keeps the work on the server.
const detailsPipeline = [
  { $match: { YearPublished: { $exists: true, $ne: null } } },
  { $group: {
      _id: '$YearPublished',
      avgRating: { $avg: '$AvgRating' },
      avgBayes: { $avg: '$BayesAvgRating' },
      gamesCount: { $sum: 1 },
      totalNumOwned: { $sum: '$NumOwned' }
  } },
  { $sort: { _id: 1 } },
  // lookup best game per year (requires index { YearPublished:1, AvgRating:-1 })
  { $lookup: {
      from: 'games_metrics',
      let: { year: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$YearPublished', '$$year'] } } },
        { $sort: { AvgRating: -1 } },
        { $project: { BGGId:1, Name:1, AvgRating:1 } },
        { $limit: 1 }
      ],
      as: 'bestGame'
  } },
  // lookup most-owned per year (requires index { YearPublished:1, NumOwned:-1 })
  { $lookup: {
      from: 'games_metrics',
      let: { year: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$YearPublished', '$$year'] } } },
        { $sort: { NumOwned: -1 } },
        { $project: { BGGId:1, Name:1, NumOwned:1 } },
        { $limit: 1 }
      ],
      as: 'mostOwned'
  } },
  { $addFields: { bestGame: { $arrayElemAt: ['$bestGame', 0] }, mostOwned: { $arrayElemAt: ['$mostOwned', 0] } } }
];

const yearDetails = db.games_metrics.aggregate(detailsPipeline, { allowDiskUse: true }).toArray();

const sortedByRating = [...yearDetails].sort((a,b)=>b.avgRating - a.avgRating);
const top3Years = sortedByRating.slice(0,3);
const bottom3Years = sortedByRating.slice(-3).reverse();

printjson({ label: 'avg_ratings_by_year_games_post', yearStatsCount: yearDetails.length, top3Years, bottom3Years, yearDetails });

// Expose a representative aggregation pipeline for explain() tooling.
var pipeline = statsPipeline;
```

05_top_games_rating_vs_popularity_post.js

```javascript
// Post-optimized: best rated vs most popular (server-side where possible)
// Replace client-side full toArray + sort with server-side find/sort/limit and small aggregations.
//
// Indexes used by this POST implementation (run these after migration):
// db.games_metrics.createIndex({ BayesAvgRating: -1 })
//   - helps: top-N by BayesAvgRating
// db.games_metrics.createIndex({ NumOwned: -1 })
//   - helps: top-N by NumOwned (popularity)
// db.ratings_distribution_clean.createIndex({ bin: 1 })
//   - helps: fast read of rating distribution bins for percentage computations
const db = db.getSiblingDB('mongo_database');

// Top N constants
const TOP_N = 3;

// Use indexed server-side sorts to get top N quickly. Use the derived `games_metrics` collection
// (lighter, pre-projected) so the indexed sorts are smaller and faster.
const topByBayes = db.games_metrics.find({}, { BGGId:1, Name:1, BayesAvgRating:1, NumOwned:1 }).sort({ BayesAvgRating: -1 }).limit(TOP_N).toArray();
const topByOwned = db.games_metrics.find({}, { BGGId:1, Name:1, BayesAvgRating:1, NumOwned:1 }).sort({ NumOwned: -1 }).limit(TOP_N).toArray();

// Compute high-rating percentage from distribution (keeps server-side read small)
const rdCursor = db.ratings_distribution_clean.find();
let highRatings = 0, total = 0;
while (rdCursor.hasNext()) {
  const bin = rdCursor.next();
  if (typeof bin.bin === 'string' && bin.bin.startsWith('8')) { highRatings += bin.count || 0; }
  else if (bin.bin && Number(bin.bin) >= 8) { highRatings += bin.count || 0; }
  total += (bin.count||0);
}
const pctHighRatings = total ? (highRatings/total)*100 : null;

printjson({ label: 'top_games_rating_vs_popularity_post', topByBayes, topByOwned, pctHighRatings });

// Expose a representative pipeline for explain tooling. The script uses server-side
// find/sort/limit to get top-N; for explain() we provide a similar aggregation that
// sorts by BayesAvgRating and limits to TOP_N so the explain output is meaningful.
var pipeline = [
  { $project: { BGGId:1, Name:1, BayesAvgRating:1, NumOwned:1 } },
  { $sort: { BayesAvgRating: -1 } },
  { $limit: TOP_N }
];
```

