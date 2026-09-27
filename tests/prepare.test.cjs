const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {prepare} = require('../bin/prepare.cjs');
const {nginxConfig} = require('../bin/project.cjs');
const projectRoot = path.resolve(__dirname, '..');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magelens-prepare-'));
    const before = process.cwd();
    process.chdir(root);
    t.after(() => { process.chdir(before); fs.rmSync(root, {recursive: true, force: true}); });
    fs.copyFileSync(`${projectRoot}/package-lock.json`, 'package-lock.json');
    fs.writeFileSync('README.md', '<!-- coverage-badges:start -->\n<!-- coverage-badges:end -->');
    const write = (file, content) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, content); };
    write('src/app/code/Acme/Blog/etc/module.xml', '<config><module name="Acme_Blog"/></config>');
    const base = 'app/code/Acme/Blog';
    write(`src/${base}/view/frontend/web/js/example.js`, 'window.answer = 42;');
    write(`src/${base}/view/frontend/web/template/example.html`, '<span data-bind="text: title"></span>');
    write(`src/${base}/Example.php`, '<?php echo 42;');
    return {root, base, write};
}
const read = file => JSON.parse(fs.readFileSync(file));

test('repeated runs reuse browser files while resetting all execution artifacts', t => {
    const {base} = fixture(t);
    prepare({runtimeOnly: true, themeRoots: []});
    const script = `.runtime/${base}/view/frontend/web/js/example.js`;
    const template = `.runtime/${base}/view/frontend/web/template/example.html`;
    const mtimes = [script, template].map(file => fs.statSync(file, {bigint: true}).mtimeNs);
    prepare({themeRoots: []});
    const first = read('coverage/run.json');
    fs.writeFileSync('coverage/old-record.json', '{}');
    prepare({themeRoots: []});
    assert.notEqual(read('coverage/run.json').id, first.id);
    assert.equal(fs.existsSync('coverage/old-record.json'), false);
    assert.equal(fs.existsSync('coverage/.active-run'), false, 'Activation waits for collector preparation');
    assert.deepEqual([script, template].map(file => fs.statSync(file, {bigint: true}).mtimeNs), mtimes);
    const baseline = read('.runtime/js-baseline.json');
    assert.ok(Object.values(Object.values(baseline)[0].s).every(hit => hit === 0));
});

test('source edits update runtime files in place without rewriting unchanged browser instrumentation', t => {
    const {base, write} = fixture(t);
    prepare({runtimeOnly: true, themeRoots: []});
    const script = `.runtime/${base}/view/frontend/web/js/example.js`;
    const original = fs.statSync(script, {bigint: true}).mtimeNs;
    write(`src/${base}/Example.php`, '<?php echo 43;');
    prepare({themeRoots: []});
    assert.equal(fs.readFileSync(`.runtime/${base}/Example.php`, 'utf8'), '<?php echo 43;');
    assert.equal(fs.statSync(script, {bigint: true}).mtimeNs, original);
    write(`src/${base}/view/frontend/web/js/example.js`, 'window.answer = 43;');
    prepare({themeRoots: []});
    assert.match(fs.readFileSync(script, 'utf8'), /window.answer = 43/);
    fs.rmSync(`src/${base}/view/frontend/web/js/example.js`);
    prepare({themeRoots: []});
    assert.equal(fs.existsSync(script), false);
});

test('theme changes replace the report scope without changing PHP startup filters', t => {
    const {write} = fixture(t);
    const themes = ['app/design/frontend/Acme/one', 'app/design/frontend/Acme/two'];
    for (const theme of themes) {
        write(`src/${theme}/theme.xml`, '<theme/>');
        write(`src/${theme}/web/theme.js`, 'window.theme = true;');
    }
    prepare({runtimeOnly: true, themeRoots: [themes[0]]});
    const ini = fs.readFileSync('.runtime/coverage.ini', 'utf8');
    prepare({themeRoots: [themes[1]]});
    assert.equal(fs.readFileSync('.runtime/coverage.ini', 'utf8'), ini);
    assert.deepEqual(read('coverage/run.json').roots, ['app/code', themes[1]]);
    assert.equal(fs.readFileSync(`.runtime/${themes[0]}/web/theme.js`, 'utf8'), 'window.theme = true;');
    const baseline = read('.runtime/js-baseline.json');
    assert.ok(Object.keys(baseline).some(file => file.includes(themes[1])));
    assert.ok(!Object.keys(baseline).some(file => file.includes(themes[0])));
});

test('missing or damaged instrumented copies are rebuilt', t => {
    const {base} = fixture(t);
    prepare({runtimeOnly: true, themeRoots: []});
    const script = `.runtime/${base}/view/frontend/web/js/example.js`;
    const expected = fs.readFileSync(script, 'utf8');
    fs.writeFileSync(script, 'broken');
    prepare({themeRoots: []});
    assert.equal(fs.readFileSync(script, 'utf8'), expected);
});

test('nginx uses the selected ports and rejects collisions and invalid ports', () => {
    const template = fs.readFileSync(`${projectRoot}/docker/nginx.conf`, 'utf8');
    const config = nginxConfig(template, {APPLICATION_PORT: '8088', APPLICATION_HTTPS_PORT: '8443', CYPRESS_VIEW_PORT: '6090'});
    assert.match(config, /listen 8088;/);
    assert.match(config, /listen 8443 ssl;/);
    assert.match(config, /listen 6090 ssl;/);
    assert.throws(() => nginxConfig(template, {APPLICATION_PORT: '443'}), /different/);
    assert.throws(() => nginxConfig(template, {APPLICATION_PORT: '70000'}), /Invalid/);
});
