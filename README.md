# Materijali_MongoDB_Metabase

Aggregation examples, benchmark harness, and helper scripts for experimenting with MongoDB aggregation pipelines.

This repository contains two sets of aggregation queries (baseline and optimized), timing wrappers and a small harness to run them all and collect durations. It was used to compare "pre-optimized" pipelines against index-friendly "post-optimized" rewrites on a local MongoDB instance.

## Repository layout

  - `run_all_with_time.js` — runs all pre then all post queries and prints timing JSON lines.
  - small per-query wrappers in `scripts/` used during development.

## Quick start

Prerequisites
## Per-query notes (kratki opisi)

Sledeći odeljak prikazuje kratak opis svakog upita, gde je "pre" i "posle" verzija i koja su preporučena indeksiranja. Ovo je kopija iz `QUERIES.md` da sve bude dostupno iz `README.md`.

### 01_mechanics_popular_by_avg_gt8

- Svrha: za svaku mehaniku (mehanike su booleani flagovi u `mechanics_clean`) naći koliko igara je ima i agregirati ocene za igre koje imaju AvgRating > 8.
- Pre (baseline): `initial-schema/queries/01_mechanics_popular_by_avg_gt8_pre.js`
  - pipeline: objectToArray + $unwind da izvuče mehanike, zatim $lookup u `games_clean` po `BGGId`, filter AvgRating>8, $group po mehanici i kalkulacije (avgRating, stddev, suma owned, itd.).
- Posle (optimizovano): `optimised-schema/queries/01_mechanics_popular_by_avg_gt8_post.js`
  - poboljšanje: koristi jednostavan `localField: 'BGGId'` / `foreignField: 'BGGId'` $lookup (da se iskoristi indeks na `games_clean.BGGId`), projektuje početni skup da smanji working set i pokreće agregaciju sa `allowDiskUse: true`.
- Kolekcije: `mechanics_clean`, `games_clean`.
- Preporučeni indeksi:

```javascript
db.games_clean.createIndex({ BGGId: 1 });
db.games_clean.createIndex({ AvgRating: -1 });
```

### 02_games_most_distinct_themes

- Svrha: za svaku igru prebrojati koliko različitih tema ima (tema su boolean flagovi u `themes_clean`) i pokazati igre sa najviše tema te distribuciju prosečnih ocena po bucketima.
- Pre: `initial-schema/queries/02_games_most_distinct_themes_pre.js`
  - pipeline: objectToArray + $unwind nad `themes_clean`, $group po `BGGId` da se izračuna `themeCount`, $lookup u `games_clean` po `BGGId`, projekcija i sortiranje.
- Posle: `optimised-schema/queries/02_games_most_distinct_themes_post.js`
  - poboljšanje: isti logički koraci ali napisan tako da lookupi koriste localField/foreignField i ne prenose nepotrebna polja pre $group.
- Kolekcije: `themes_clean`, `games_clean`.
- Preporučeni indeksi:

```javascript
db.games_clean.createIndex({ BGGId: 1 });
db.games_clean.createIndex({ AvgRating: -1 });
db.games_clean.createIndex({ NumOwned: -1 });
```

### 03_avg_rating_by_designer_publisher

- Svrha: za parove (designer, publisher) izračunati prosečne ocene (AvgRating i BayesAvgRating) i filtrirati parove sa najmanje N ocena (npr. totalNumUserRatings >= 500) da dobijemo stabilnije rezultate.
- Pre: `initial-schema/queries/03_avg_rating_by_designer_publisher_pre.js`
  - pipeline: iz `designers_reduced_clean` izvlači se svaki designer flag, $lookup u `games_clean` po `BGGId`, $group po {designer, publisher}, prebrojavanje i agregacije, zatim filter po totalNumUserRatings.
- Posle: `optimised-schema/queries/03_avg_rating_by_designer_publisher_post.js`
  - poboljšanje: slična logika ali sa manjim radnim skupom i SUGESTIJA da `games_clean.BGGId` indeks postoji da lookup bude brz.
- Kolekcije: `designers_reduced_clean`, `games_clean`.
- Preporučeni indeksi:

```javascript
db.games_clean.createIndex({ BGGId: 1 });
db.games_clean.createIndex({ Publisher: 1 });
```

### 04_avg_ratings_by_year_games

- Svrha: izračunati prosečne ocene po godini izdavanja, broj igara po godini i za svaku godinu naći najbolje ocenjene i najviše posedovane igre.
- Pre: `initial-schema/queries/04_avg_ratings_by_year_games_pre.js`
  - pipeline: $match YearPublished exists, $group po YearPublished (avg/avgBayes/count/sum owned), sortiranje. Dodatno koristi `find().sort().limit(1)` za best/mostOwned po godini.
- Posle: `optimised-schema/queries/04_avg_ratings_by_year_games_post.js`
  - poboljšanje: ista logika; preporuka je indeks na `YearPublished` i (za brzo sortiranje po AvgRating/NumOwned) indeksi na te kolone.
- Kolekcije: `games_clean`.
- Preporučeni indeksi:

```javascript
db.games_clean.createIndex({ YearPublished: 1 });
db.games_clean.createIndex({ AvgRating: -1 });
db.games_clean.createIndex({ NumOwned: -1 });
```

### 05_top_games_rating_vs_popularity

- Svrha: uporediti rangiranje igara po ocenama (BayesAvgRating) i po popularnosti (NumOwned) te izvući "hidden gems" (visoke ocene, niska posedovanost), "hype" (visoka posedovanost, niža ocena) i igre koje su "high both".
- Pre: `initial-schema/queries/05_top_games_rating_vs_popularity_pre.js`
  - logika: dohvat svih igara (`find({})` ograničenim projektovanjem polja), lokalno sortiranje i rangiranje u JS, izračun delta rankova i binarne preseke (kvartili) za identifikaciju grupa.
- Posle: `optimised-schema/queries/05_top_games_rating_vs_popularity_post.js`
  - poboljšenje: manje promena u algoritmu (ovo je više CPU/IO bound jer radi `find({})` preko cele kolekcije), preporuka je indeks za `NumOwned` i `BayesAvgRating` ako često radite sortiranja ili top-K.
- Kolekcije: `games_clean`, `ratings_distribution_clean`.
- Preporučeni indeksi:

```javascript
db.games_clean.createIndex({ NumOwned: -1 });
db.games_clean.createIndex({ BayesAvgRating: -1 });
db.ratings_distribution_clean.createIndex({ bin: 1 });
```

### Kako dobiti stvarna vremena (pre/post)

1. Pokrenite harness koji ispisuje sve rezultate:

```powershell
docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
  mongosh --host host.docker.internal --port 27018 /workspace/scripts/run_all_with_time.js \
  > .\bench_results\all_prepost_outputs.json
```

2. Izvučite samo JSON timing linije (preporučeno):

```powershell
Select-String -Path .\bench_results\all_prepost_outputs.json -Pattern '"stage"' \
  | ForEach-Object { $_.Line } | Out-File -FilePath .\bench_results\prepost_runs_with_time.jsonl -Encoding utf8
```

3. Pokrenite `scripts/extract_durations.py` (uređujte PUTANJU u skriptu ako je potrebno) da dobijete CSV i JSONL sa zapisima o trajanju:

```powershell
python .\scripts\extract_durations.py
```

### Timing summary (last run)

Tabela ispod sadrži min/median/mean trajanja za prethodno pokretanje harness-a (iz `bench_results/prepost_runs_with_time.jsonl`). Ako imaš više pokretanja, mogu agregirati po medijani ili minimumu.

| Script | Stage | Runs | Min (ms) | Median (ms) | Mean (ms) |
|---|---:|---:|---:|---:|---:|
| 01_mechanics_popular_by_avg_gt8_post.js | post | 1 | 18080 | 18080 | 18080 |
| 02_games_most_distinct_themes_post.js | post | 1 | 11846 | 11846 | 11846 |
| 02_games_most_distinct_themes_pre.js | pre | 1 | 10949 | 10949 | 10949 |
| 03_avg_rating_by_designer_publisher_post.js | post | 1 | 45799 | 45799 | 45799 |
| 03_avg_rating_by_designer_publisher_pre.js | pre | 1 | 56159 | 56159 | 56159 |
| 04_avg_ratings_by_year_games_post.js | post | 1 | 7935 | 7935 | 7935 |
| 04_avg_ratings_by_year_games_pre.js | pre | 1 | 7256 | 7256 | 7256 |
| 05_top_games_rating_vs_popularity_post.js | post | 1 | 12850 | 12850 | 12850 |
| 05_top_games_rating_vs_popularity_pre.js | pre | 1 | 9795 | 9795 | 9795 |

Timing JSON summary written to `bench_results/timing_summary.json`
- Docker (to run a temporary `mongo:7.0` container with `mongosh`), or a running MongoDB instance accessible from your machine.
- Node.js is not strictly required (scripts are mongosh JS) but handy for small helpers.

Run the benchmark harness (PowerShell example)

```powershell
# run the harness inside the official mongo image and capture full stdout
docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
  mongosh --host host.docker.internal --port 27018 /workspace/scripts/run_all_with_time.js \
  > .\bench_results\all_prepost_outputs.json

# extract the timing JSON lines into a jsonl file (one JSON per line)
Select-String -Path .\bench_results\all_prepost_outputs.json -Pattern '"stage"' \
  | ForEach-Object { $_.Line } | Out-File -FilePath .\bench_results\prepost_runs_with_time.jsonl -Encoding utf8
```

Notes
- The harness prints human-readable output and also prints one final timing JSON line per script in the form: `{ stage, script, durationMillis }` — the extraction step above pulls those timing lines into a compact `jsonl` file.
- The examples in `initial-schema/queries` are the baseline queries used when profiling. The `optimised-schema/queries` files contain refactors intended to reduce work (use localField/foreignField, add indexes, avoid expensive $unwind/$lookup patterns).

## Running a single query

You can run any individual query file with `mongosh` the same way. Example (PowerShell):

```powershell
docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
  mongosh --host host.docker.internal --port 27018 /workspace/initial-schema/queries/01_mechanics_popular_by_avg_gt8_pre.js \
  > .\bench_results\pre_01_mechanics_popular_by_avg_gt8.json
```

## Interpreting results

- `bench_results/prepost_runs_with_time.jsonl` contains timing records that can be loaded into Python, Node, or spreadsheet software for comparison.
- `bench_results/summary_prepost*.csv` (when present) summarizes PRE vs POST durations and percent changes. If you run the harness multiple times, the jsonl file will append multiple timing records — take the min/median as appropriate for stable comparisons.

## Common tasks

- Add an index used by a post-optimized script inside your MongoDB before running the optimized pipeline (the README of each query may mention required indexes).
- If you re-generate all outputs and want to keep only the summaries, archive `bench_results/` first and then delete large `*.json` files.

PowerShell helpers (example cleanup)

```powershell
# backup bench_results then remove large json outputs
Compress-Archive -Path .\bench_results -DestinationPath .\bench_results_backup.zip
Get-ChildItem -Path .\bench_results -Filter "*.json" | Remove-Item
```

## Contributing

- Make changes in a branch, add tests or a sample run if you add or modify a query, and open a PR. Prefer small, focused changes: e.g., "optimize lookup for X" or "add timing wrapper for Y".
- If you add dataset-import helpers, include short reproducible instructions and example `mongorestore` or `mongoimport` commands.

## License

This repository contains course/materials-style code. Add a LICENSE file (e.g. MIT) if you want to open-source the content.

---

If you'd like, I can also add a short `CONTRIBUTING.md`, or expand this README with example outputs and a short summary CSV produced from the last run. Which would you prefer next?
# Materijali_MongoDB_Metabase

Aggregation examples and benchmark scripts for MongoDB.

What this repo contains
- `initial-schema/queries/` — pre-optimized (baseline) aggregation scripts
- `optimised-schema/queries/` — post-optimized (index-friendly) scripts
- `scripts/run_all_with_time.js` — run all pre/post pipelines and print timings
- `scripts/` — helper and utility scripts (some experimental files may be present)
- `bench_results/summary_prepost*.csv` — summary CSVs kept in the repo; large raw outputs are ignored

Notes
- Large raw data and dumps are intentionally ignored (`dump/`, `data/`, `.bson`, `.csv`).
- If you need large file versioning, consider using Git LFS.
- To run benchmarks, use the Docker + mongosh pattern with `mongo:7.0` and mount this workspace.

Quick start
1. Ensure MongoDB is running and accessible (this workspace expects host.docker.internal:27018 in the local setup used here).
2. Run all queries and capture timing:
   ```powershell
   docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
     mongosh --host host.docker.internal --port 27018 /workspace/scripts/run_all_with_time.js \
     > .\bench_results\all_prepost_outputs.json
   ```

3. Extract timing lines:
   ```powershell
   Select-String -Path .\bench_results\all_prepost_outputs.json -Pattern '"stage"' \
     | ForEach-Object { $_.Line } | Out-File -FilePath .\bench_results\prepost_runs_with_time.jsonl -Encoding utf8
   ```
