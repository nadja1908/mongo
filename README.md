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
