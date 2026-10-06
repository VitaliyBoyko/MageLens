const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {createInstrumenter} = require('istanbul-lib-instrument');
const {prepare} = require('../bin/prepare.cjs');
const projectRoot = path.resolve(__dirname, '..');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magelens-browser-report-'));
    const before = process.cwd();
    process.chdir(root);
    t.after(() => { process.chdir(before); fs.rmSync(root, {recursive: true, force: true}); });
    for (const file of ['package.json', 'package-lock.json']) fs.copyFileSync(`${projectRoot}/${file}`, file);
    fs.symlinkSync(path.dirname(path.dirname(require.resolve('nyc/package.json'))), 'node_modules', 'dir');
    fs.writeFileSync('README.md', '<!-- coverage-badges:start -->\n<!-- coverage-badges:end -->');
    const base = 'app/code/Acme/Blog';
    const write = (file, content) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, content); };
    write(`src/${base}/etc/module.xml`, '<config><module name="Acme_Blog"/></config>');
    for (const name of ['loaded', 'unvisited']) write(`src/${base}/view/frontend/web/js/${name}.js`, `window.${name} = true;`);
    write(`src/${base}/view/frontend/web/template/example.html`, '<span data-bind="text: title"></span>');
    prepare({themeRoots: []});
    fs.mkdirSync('.nyc_output', {recursive: true});
    return {base, write};
}

function coverage(file) {
    const instrumenter = createInstrumenter();
    instrumenter.instrumentSync('window.example = true;', path.resolve(file));
    return instrumenter.lastFileCoverage();
}

test('real JavaScript reports omit stale Cypress records and retain unvisited application files', t => {
    const {base} = fixture(t);
    const context = {window: {}};
    vm.runInNewContext(fs.readFileSync(`.runtime/${base}/view/frontend/web/js/loaded.js`, 'utf8'), context);
    const raw = context.window.__coverage__;
    const baseline = JSON.parse(fs.readFileSync('.runtime/js-baseline.json'));
    const tests = [
        `src/${base}/Test/Cypress/support.js`,
        `src/${base}/Test/Cypress/helpers/navigation.js`,
        `src/${base}/Test/example.cy.js`,
        `src/${base}/cypress/support/commands.js`,
        'cypress/e2e/example.cy.js'
    ];
    for (const file of tests) {
        raw[path.resolve(file)] = coverage(file);
        baseline[path.resolve(file)] = coverage(file);
    }
    fs.writeFileSync('.runtime/js-baseline.json', JSON.stringify(baseline));
    fs.writeFileSync('.nyc_output/out.json', JSON.stringify(raw));
    execFileSync(process.execPath, [`${projectRoot}/bin/report-browser.cjs`], {encoding: 'utf8'});
    const summary = JSON.parse(fs.readFileSync('coverage/js/coverage-summary.json'));
    const loaded = path.resolve(`src/${base}/view/frontend/web/js/loaded.js`);
    const unvisited = path.resolve(`src/${base}/view/frontend/web/js/unvisited.js`);
    assert.deepEqual(Object.keys(summary).sort(), [loaded, unvisited, 'total'].sort());
    assert.equal(summary.total.statements.total, 2);
    assert.equal(summary.total.statements.covered, 1);
    assert.equal(summary.total.statements.pct, 50);
    assert.equal(summary[unvisited].statements.covered, 0);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync('.nyc_output/out.json'))).sort(), [loaded, unvisited].sort());
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync('coverage/js/coverage-final.json'))).sort(), [loaded, unvisited].sort());

    // Verify nyc's own exclusions also protect reports made directly from raw counters.
    for (const file of tests) raw[path.resolve(file)] = coverage(file);
    fs.writeFileSync('.nyc_output/out.json', JSON.stringify({...baseline, ...raw}));
    execFileSync('node_modules/.bin/nyc', ['report'], {encoding: 'utf8'});
    const direct = JSON.parse(fs.readFileSync('coverage/js/coverage-summary.json'));
    assert.deepEqual(Object.keys(direct).sort(), [loaded, unvisited, 'total'].sort());
    assert.equal(direct.total.statements.pct, 50);
});

test('reporting still rejects application coverage outside the discovered scope', t => {
    fixture(t);
    const file = path.resolve('src/vendor/unexpected.js');
    fs.writeFileSync('.nyc_output/out.json', JSON.stringify({[file]: coverage(file)}));
    assert.throws(() => execFileSync(process.execPath, [`${projectRoot}/bin/report-browser.cjs`], {encoding: 'utf8', stdio: 'pipe'}),
        error => error.status !== 0 && error.stderr.toString().includes(`Browser coverage outside the discovered scope: ${file}`));
});
