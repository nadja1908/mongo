// run_pre_only_with_time.js
// Run all scripts under initial-schema/queries and print timing JSON lines
const fs = require('fs');
const path = require('path');
const startAll = Date.now();
const qdir = '/workspace/initial-schema/queries';
const files = fs.readdirSync(qdir).filter(f=>f.endsWith('.js')).sort();
for (const f of files) {
  const full = path.join(qdir, f);
  print('Running pre script: ' + full);
  const t0 = Date.now();
  load(full);
  const d = Date.now() - t0;
  printjson({ stage: 'pre', script: full, durationMillis: d });
}
printjson({ stage: 'pre-run-all', durationMillis: Date.now() - startAll });
