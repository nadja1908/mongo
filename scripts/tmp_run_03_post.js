// wrapper to run single query script and print timing JSON
const start = Date.now();
load('/workspace/optimised-schema/queries/03_avg_rating_by_designer_publisher_post.js');
const duration = Date.now() - start;
printjson({ stage: 'post', script: '03_avg_rating_by_designer_publisher_post.js', durationMillis: duration });
