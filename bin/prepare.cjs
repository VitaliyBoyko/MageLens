const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomBytes} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {setBadgeSection} = require('./badges.cjs');
const {discover, files, writeRuntime} = require('./project.cjs');
function sourceHashes() {
    return Object.fromEntries(applicationFiles().map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}
function applicationFiles() {
    return discover().roots.flatMap(root => files(`src/${root}`));
}

if (require.main === module) {
    const project = discover();
    sourceHashes(); // Reject unsupported sources before modifying runtime copies.
    // Preserve bind-mount directory inodes; replace their contents instead.
    for (const root of project.roots) {
        const target = `.runtime/${root}`;
        fs.mkdirSync(target, {recursive: true});
        for (const name of fs.readdirSync(target)) fs.rmSync(`${target}/${name}`, {recursive: true, force: true});
        fs.cpSync(`src/${root}`, target, {recursive: true});
    }
    writeRuntime(project);
    if (!process.argv.includes('--plain')) {
        const {createInstrumenter} = require('istanbul-lib-instrument');
        fs.mkdirSync('coverage', {recursive: true});
        for (const name of fs.readdirSync('coverage')) fs.rmSync(`coverage/${name}`, {recursive: true, force: true});
        for (const directory of ['.nyc_output', 'cypress/screenshots', 'cypress/videos']) {
            fs.rmSync(directory, {recursive: true, force: true});
        }
        fs.mkdirSync('coverage/raw/templates', {recursive: true});
        const run = {id: randomBytes(16).toString('hex'), startedAt: new Date().toISOString(), sources: sourceHashes()};
        fs.mkdirSync(`coverage/raw/php/${run.id}`, {recursive: true, mode: 0o777});
        fs.chmodSync(`coverage/raw/php/${run.id}`, 0o777); // FPM's app user may differ from the host UID.
        fs.writeFileSync('coverage/run.json', JSON.stringify(run, null, 2));
        fs.writeFileSync('coverage/.active-run', run.id);
        setBadgeSection('Coverage has not completed for the current run.');
        const cli = 'node_modules/.bin/magento-template-coverage';
        // Scope by source location, with no namespace or module-name exclusions.
        const roots = project.roots;
        if (!roots.length) throw new Error('No source found in src/app/code or src/app/design');
        execFileSync(cli, ['inventory', '--source', '/source', '--manifest', 'coverage/template-manifest.json',
            ...roots.flatMap(root => ['--root', root])], {stdio: 'inherit'});
        execFileSync(cli, ['instrument', '--source', '/source', '--manifest', 'coverage/template-manifest.json',
            ...roots.flatMap(root => ['--map', `${root}=/workspace/.runtime/${root}`])], {stdio: 'inherit'});
        const baseline = {};
        for (const file of applicationFiles().filter(file => file.endsWith('.js'))) {
            const instrumenter = createInstrumenter({compact: false, preserveComments: true,
                coverageGlobalScope: 'window', coverageGlobalScopeFunc: false});
            const instrumented = instrumenter.instrumentSync(fs.readFileSync(file, 'utf8'), path.resolve(file));
            fs.writeFileSync(path.join('.runtime', path.relative('src', file)), instrumented);
            baseline[path.resolve(file)] = instrumenter.lastFileCoverage();
        }
        fs.writeFileSync('.runtime/js-baseline.json', JSON.stringify(baseline));
        console.log(`Prepared fresh coverage run ${run.id}; originals unchanged.`);
    }
}
module.exports = {sourceHashes};
