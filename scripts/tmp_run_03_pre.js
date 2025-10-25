// wrapper to run single query script and print timing JSON
const start = Date.now();
load('/workspace/initial-schema/queries/03_avg_rating_by_designer_publisher_pre.js');
const duration = Date.now() - start;
printjson({ stage: 'pre', script: '03_avg_rating_by_designer_publisher_pre.js', durationMillis: duration });
