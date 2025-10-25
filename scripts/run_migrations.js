// run_migrations.js
// Runs all migration scripts in order and prints progress
print('Running migrations: games_metrics, designer_game, mechanic_to_games, designer_publisher_agg');
load('/workspace/scripts/migrate_games_metrics.js');
load('/workspace/scripts/migrate_designer_game.js');
load('/workspace/scripts/migrate_mechanic_to_games.js');
load('/workspace/scripts/migrate_designer_publisher_agg.js');
print('All migrations completed.');
