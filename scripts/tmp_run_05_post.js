// wrapper to run single query script and print timing JSON
const start = Date.now();
load('/workspace/optimised-schema/queries/05_top_games_rating_vs_popularity_post.js');
const duration = Date.now() - start;
printjson({ stage: 'post', script: '05_top_games_rating_vs_popularity_post.js', durationMillis: duration });
