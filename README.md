# Materijali_MongoDB_Metabase

Aggregation examples, benchmark harness, and helper scripts for experimenting with MongoDB aggregation pipelines.

This repository contains two sets of aggregation queries (baseline and optimized), timing wrappers and a small harness to run them all and collect durations. It was used to compare "pre-optimized" pipelines against index-friendly "post-optimized" rewrites on a local MongoDB instance.

## Repository layout

- `initial-schema/queries/` — baseline (pre-optimization) aggregation scripts.
- `optimised-schema/queries/` — optimized (post-optimization) aggregation scripts.
- `scripts/` — helper scripts and timing wrappers. Key files:
  - `run_all_with_time.js` — runs all pre then all post queries and prints timing JSON lines.
  - small per-query wrappers in `scripts/` used during development.
- `bench_results/` — generated outputs, consolidated timing logs and summary CSVs. Large raw JSON outputs are intentionally excluded from the repo with `.gitignore` but a few summary CSVs may be present.
- `dump/` — exported BSON dumps (kept out of git)

## Quick start

Prerequisites
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
