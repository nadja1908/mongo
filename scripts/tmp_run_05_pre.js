// wrapper to run single query script and print timing JSON
const start = Date.now();
load('/workspace/initial-schema/queries/05_top_games_rating_vs_popularity_pre.js');
const duration = Date.now() - start;
printjson({ stage: 'pre', script: '05_top_games_rating_vs_popularity_pre.js', durationMillis: duration });
