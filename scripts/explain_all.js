// explain_all.js
// Read each query file, extract the `pipeline` definition, run explain('executionStats')
// against the intended collection and print a short summary.
// Usage (PowerShell + Docker):
// docker run --rm -v ${PWD}:/workspace -w /workspace mongo:7.0 \
//   mongosh --host host.docker.internal --port 27018 /workspace/scripts/explain_all.js

const db = db.getSiblingDB('mongo_database');

const queries = [
  { path: 'initial-schema/queries/01_mechanics_popular_by_avg_gt8_pre.js', coll: 'mechanics_clean' },
  { path: 'optimised-schema/queries/01_mechanics_popular_by_avg_gt8_post.js', coll: 'mechanics_clean' },

  { path: 'initial-schema/queries/02_games_most_distinct_themes_pre.js', coll: 'themes_clean' },
  { path: 'optimised-schema/queries/02_games_most_distinct_themes_post.js', coll: 'themes_clean' },

  { path: 'initial-schema/queries/03_avg_rating_by_designer_publisher_pre.js', coll: 'designers_reduced_clean' },
  { path: 'optimised-schema/queries/03_avg_rating_by_designer_publisher_post.js', coll: 'designers_reduced_clean' },

  { path: 'initial-schema/queries/04_avg_ratings_by_year_games_pre.js', coll: 'games_clean' },
  { path: 'optimised-schema/queries/04_avg_ratings_by_year_games_post.js', coll: 'games_clean' },

  { path: 'initial-schema/queries/05_top_games_rating_vs_popularity_pre.js', coll: 'games_clean' },
  { path: 'optimised-schema/queries/05_top_games_rating_vs_popularity_post.js', coll: 'games_clean' }
];

function extractPipeline(src) {
  // match `const pipeline = [ ... ];` including nested content
  const re = /const\s+pipeline\s*=\s*(\[[\s\S]*?\]);/m;
  const m = src.match(re);
  if (!m) return null;
  const code = m[1];
  // Evaluate pipeline in a safe REPL context (mongosh environment)
  try {
    // eslint-disable-next-line no-eval
    const pipeline = eval(code);
    return pipeline;
  } catch (e) {
    print(`Failed to eval pipeline: ${e}`);
    return null;
  }
}

for (const q of queries) {
  try {
    print('------------------------------------------------------------');
    print(`Processing: ${q.path}  (collection: ${q.coll})`);
    const src = cat(q.path);
    const pipeline = extractPipeline(src);
    if (!pipeline) {
      print(`Could not find pipeline in ${q.path}. Skipping.`);
      continue;
    }

    print('Running explain("executionStats") ... (this may take time)');
    const explainRes = db.getCollection(q.coll).explain('executionStats').aggregate(pipeline);

    // Summarize useful fields
    const stats = explainRes.executionStats || explainRes;
    const summary = {
      script: q.path,
      collection: q.coll,
      executionTimeMillis: stats.executionTimeMillis || (stats.executionTimeMillisEstimate || null),
      totalDocsExamined: stats.totalDocsExamined || null,
      totalKeysExamined: stats.totalKeysExamined || null,
      nReturned: (stats.nReturned != null) ? stats.nReturned : (stats.executionStages && stats.executionStages.nReturned) || null,
      winningPlan: explainRes.winningPlan ? explainRes.winningPlan.stage || '[plan]' : null
    };

    printjson({ explainSummary: summary });
  } catch (err) {
    print(`Error while explaining ${q.path}: ${err}`);
  }
}

print('All done. Review the printed explain summaries.');
