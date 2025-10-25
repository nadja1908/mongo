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
