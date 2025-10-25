# Per-query notes (kratki opisi)

Ovaj fajl sadrži kratke bilješke o svakom od pet upita korišćenih u benchmarku: šta upit radi, kako je izgledao "pre" i kako je optimizovan "posle", koje kolekcije koristi i koja indeksiranja se preporučuju.

NAPOMENA: Vremena izvršavanja nisu hardkodirana ovde — preporučujem da pokrenete `scripts/run_all_with_time.js` pa izvučete vremenske zapise u `bench_results/prepost_runs_with_time.jsonl`. Postoji i pomoćni skript `scripts/extract_durations.py` koji može parsirati izlaz.


## 01_mechanics_popular_by_avg_gt8

- Svrha: za svaku mehaniku (mehanike su booleani flagovi u `mechanics_clean`) naći koliko igara je ima i agregirati ocene za igre koje imaju AvgRating > 8.
- Pre (baseline): `initial-schema/queries/01_mechanics_popular_by_avg_gt8_pre.js`
  - pipeline: objectToArray + $unwind da izvuče mehanike, zatim $lookup u `games_clean` po `BGGId`, filter AvgRating>8, $group po mehanici i kalkulacije (avgRating, stddev, suma owned, itd.).
- Posle (optimizovano): `optimised-schema/queries/01_mechanics_popular_by_avg_gt8_post.js`
  - poboljšanje: koristi jednostavan `localField: 'BGGId'` / `foreignField: 'BGGId'` $lookup (da se iskoristi indeks na `games_clean.BGGId`), projektuje početni skup da smanji working set i pokreće agregaciju sa `allowDiskUse: true`.
- Kolekcije: `mechanics_clean`, `games_clean`.
- Preporučeni indeksi (pokrenuti u mongosh):

```javascript
db.games_clean.createIndex({ BGGId: 1 });
```

Opcionalno (ako često filtrirate po AvgRating ili sortirate):

```javascript
db.games_clean.createIndex({ AvgRating: -1 });
```

Gde su vremena: pokrenite harness i izvadite linije iz `bench_results/all_prepost_outputs.json` ili koristite `prepost_runs_with_time.jsonl`.


## 02_games_most_distinct_themes

- Svrha: za svaku igru prebrojati koliko različitih tema ima (tema su boolean flagovi u `themes_clean`) i pokazati igre sa najviše tema te distribuciju prosečnih ocena po bucketima.
- Pre: `initial-schema/queries/02_games_most_distinct_themes_pre.js`
  - pipeline: objectToArray + $unwind nad `themes_clean`, $group po `BGGId` da se izračuna `themeCount`, $lookup u `games_clean` po `BGGId`, projekcija i sortiranje.
- Posle: `optimised-schema/queries/02_games_most_distinct_themes_post.js`
  - poboljšanje: isti logički koraci ali napisan tako da lookupi koriste localField/foreignField i ne prenose nepotrebna polja pre $group.
- Kolekcije: `themes_clean`, `games_clean`.
- Preporučeni indeksi:

```javascript
db.games_clean.createIndex({ BGGId: 1 });
```

Ako česte agregacije po `AvgRating`/`NumOwned` dodajte:

```javascript
db.games_clean.createIndex({ AvgRating: -1 });
db.games_clean.createIndex({ NumOwned: -1 });
```


## 03_avg_rating_by_designer_publisher

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

Napomena: indeks na `Publisher` može pomoći prilikom dodatnih filtarskih upita po izdavaču, ali sam `BGGId` indeks je ključan za brz lookup.


## 04_avg_ratings_by_year_games

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


## 05_top_games_rating_vs_popularity

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


## Kako dobiti stvarna vremena (pre/post)

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

Skripta će parsirati nalaze `label:` i `durationMillis` iz izlaza i zapisati sažetak u `bench_results/`.


---

Ako želiš, mogu automatski popuniti polja `durationMillis` u ovu dokumentaciju čitanjem `bench_results/prepost_runs_with_time.jsonl` — potvrdi da želiš da to uradim i hoćeš li da agregiram (min/median) vrednosti ako je bilo više pokretanja.
