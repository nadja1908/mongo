// scripts/inspect_ratings_fields.js
const d = db.getSiblingDB('mongo_database');
print('--- one document from user_ratings_sample1M ---');
printjson(d.getCollection('user_ratings_sample1M').findOne());

print('\n--- keys of that document ---');
const doc = d.getCollection('user_ratings_sample1M').findOne();
if (doc) printjson(Object.keys(doc)); else print('no document found');
