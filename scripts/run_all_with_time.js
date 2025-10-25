// Run all pre-optimized then post-optimized queries and print timing JSON lines
const pre = [
  '/workspace/initial-schema/queries/01_mechanics_popular_by_avg_gt8_pre.js',
  '/workspace/initial-schema/queries/02_games_most_distinct_themes_pre.js',
  '/workspace/initial-schema/queries/03_avg_rating_by_designer_publisher_pre.js',
  '/workspace/initial-schema/queries/04_avg_ratings_by_year_games_pre.js',
  '/workspace/initial-schema/queries/05_top_games_rating_vs_popularity_pre.js'
];
const post = [
  '/workspace/optimised-schema/queries/01_mechanics_popular_by_avg_gt8_post.js',
  '/workspace/optimised-schema/queries/02_games_most_distinct_themes_post.js',
  '/workspace/optimised-schema/queries/03_avg_rating_by_designer_publisher_post.js',
  '/workspace/optimised-schema/queries/04_avg_ratings_by_year_games_post.js',
  '/workspace/optimised-schema/queries/05_top_games_rating_vs_popularity_post.js'
];

function runList(list, stage){
  list.forEach(path => {
    const t0 = Date.now();
    // load the script (its prints will go to stdout)
    try{
      load(path);
    }catch(e){
      print(JSON.stringify({stage: stage, script: path, error: String(e)}));
      return;
    }
    print(JSON.stringify({stage: stage, script: path, durationMillis: Date.now() - t0}));
  });
}

runList(pre, 'pre');
runList(post, 'post');
