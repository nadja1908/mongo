// run_explains_explicit.js
// Runs explain('executionStats') for each POST query against the collection the query uses.
// Writes per-query explain JSON to bench_results/explain_<script_basename>.json
const fs = require('fs');
const path = require('path');
const db = db.getSiblingDB('mongo_database');

const queries = [
  { file: '/workspace/optimised-schema/queries/01_mechanics_popular_by_avg_gt8_post.js', coll: 'mechanic_to_games', name: '01_mechanics_post' },
  { file: '/workspace/optimised-schema/queries/02_games_most_distinct_themes_post.js', coll: 'games_metrics', name: '02_themes_post' },
  { file: '/workspace/optimised-schema/queries/03_avg_rating_by_designer_publisher_post.js', coll: 'designer_publisher_agg', name: '03_designer_post' },
  { file: '/workspace/optimised-schema/queries/04_avg_ratings_by_year_games_post.js', coll: 'games_metrics', name: '04_years_post' },
  { file: '/workspace/optimised-schema/queries/05_top_games_rating_vs_popularity_post.js', coll: 'games_metrics', name: '05_top_post' }
];

if (!fs.existsSync('/workspace/bench_results')) fs.mkdirSync('/workspace/bench_results');
if (!fs.existsSync('/workspace/bench_results/explains_post')) fs.mkdirSync('/workspace/bench_results/explains_post');

for (const q of queries) {
  try {
    print('Processing: ' + q.file + '  (collection: ' + q.coll + ')');
    // load the script which (by convention) defines a `pipeline` variable
    load(q.file);
    if (typeof pipeline === 'undefined') {
      print('Error: pipeline not defined in ' + q.file);
      continue;
    }
    const explain = db.getCollection(q.coll).explain('executionStats').aggregate(pipeline);
    const outPath = '/workspace/bench_results/explains_post/explain_' + q.name + '.json';
    const content = JSON.stringify(explain, null, 2);
    fs.writeFileSync(outPath, content, { encoding: 'utf8' });
    print('Wrote explain to ' + outPath);
    // undefine pipeline to avoid bleed between files
    pipeline = undefined;
  } catch (e) {
    print('Error while explaining ' + q.file + ': ' + e);
  }
}

print('All explains written.');
