const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {createCoverageMap} = require('istanbul-lib-coverage');
const raw = fs.existsSync('.nyc_output/out.json') ? JSON.parse(fs.readFileSync('.nyc_output/out.json')) : {};
const actual = createCoverageMap(raw);
const baseline = createCoverageMap(JSON.parse(fs.readFileSync('.runtime/js-baseline.json')));
// Zero counters captured DURING instrumentation include JS never loaded by a test.
// Merging these cannot invent a hit, including when no scoped script was loaded.
for (const file of actual.files()) {
    if (!baseline.files().includes(file)) throw new Error(`Browser coverage outside the discovered scope: ${file}`);
}
baseline.merge(actual);
fs.mkdirSync('.nyc_output', {recursive: true});
fs.writeFileSync('.nyc_output/out.json', JSON.stringify(baseline));
execFileSync('node_modules/.bin/nyc', ['report'], {stdio: 'inherit'});
execFileSync('node_modules/.bin/magento-template-coverage', ['report',
    '--manifest', 'coverage/template-manifest.json', '--hits', 'coverage/raw/templates',
    '--output', 'coverage/templates'], {stdio: 'inherit'});
