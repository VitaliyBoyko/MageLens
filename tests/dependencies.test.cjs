const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');
const {syncDependencies} = require('../bin/sync-dependencies.cjs');
const root = path.resolve(__dirname, '..');
const yaml = fs.readFileSync(path.join(root, 'dependencies.yaml'), 'utf8');
const configured = key => yaml.match(new RegExp(`^${key}: \"([^\"]+)\"`, 'm'))[1];
const select = (content, values) => Object.entries(values).reduce((text, [key, value]) =>
    text.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: \"${value}\"`), content);

function workspace(t) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'magelens-test-'));
    t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
    return temporary;
}

function parse(file, env = {}) {
    return spawnSync('bash', ['-eu', '-c',
        'source "$1"; load_dependencies "$2"; printf "%s\\n" "$MAGENTO_VERSION" "$MARKSHUST_DOCKER_MAGENTO_VERSION" "$RUNNER_IMAGE"',
        'test', path.join(root, 'bin/dependencies'), file], {encoding: 'utf8', env: {...process.env, ...env}});
}

test('dependency YAML overrides stale environment variables and accepts comments, quotes and CRLF', t => {
    const file = path.join(workspace(t), 'dependencies.yaml');
    fs.writeFileSync(file, yaml.replaceAll('"', "'").replaceAll('\n', '\r\n'));
    const result = parse(file, {MAGENTO_VERSION: '0.0.0'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, ['MAGENTO_VERSION', 'MARKSHUST_DOCKER_MAGENTO_VERSION', 'RUNNER_IMAGE'].map(configured).join('\n') + '\n');
});

test('dependency YAML rejects missing, duplicate, unknown and unsafe values', t => {
    const file = path.join(workspace(t), 'dependencies.yaml');
    for (const content of [
        yaml.replace(/^PCOV_VERSION:.*\n/m, ''),
        yaml + 'PCOV_VERSION: "2.1.3"\n',
        yaml + 'TYPO_VERSION: "1.2.3"\n',
        select(yaml, {MAGENTO_VERSION: '$(touch /tmp/magelens-must-not-execute)'}),
        select(yaml, {CYPRESS_VERSION: 'latest'}),
        yaml.replace(/^CYPRESS_VERSION:.*$/m, 'CYPRESS_VERSION: 16.1.0')
    ]) {
        fs.writeFileSync(file, content);
        const result = parse(file);
        assert.notEqual(result.status, 0, content);
        assert.ok(result.stderr.includes('dependencies.yaml'));
    }
});

function manifests(directory, version = '1.0.0') {
    const dependencies = {cypress: version, '@vitaliiboiko/magento-template-coverage': version, unrelated: '3.0.0'};
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name: 'fixture', devDependencies: dependencies, nyc: {include: ['keep']}}));
    fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify({lockfileVersion: 3, packages: {
        '': {devDependencies: dependencies},
        ...Object.fromEntries(Object.entries(dependencies).map(([name, version]) => [`node_modules/${name}`, {version}]))
    }}));
}

test('changing browser versions updates both manifests before npm ci, without changing other settings', t => {
    const directory = workspace(t);
    manifests(directory);
    let resolutions = 0;
    const resolve = (command, args, options) => {
        resolutions++;
        assert.equal(command, 'npm');
        assert.deepEqual(args, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
        assert.notEqual(options.cwd, directory);
        const manifest = JSON.parse(fs.readFileSync(path.join(options.cwd, 'package.json')));
        const lock = {lockfileVersion: 3, packages: {'': {devDependencies: manifest.devDependencies}}};
        for (const [name, version] of Object.entries(manifest.devDependencies)) lock.packages[`node_modules/${name}`] = {version};
        fs.writeFileSync(path.join(options.cwd, 'package-lock.json'), JSON.stringify(lock));
    };
    const selected = {CYPRESS_VERSION: '16.2.0', TEMPLATE_COVERAGE_VERSION: '1.2.0'};
    assert.equal(syncDependencies(directory, selected, resolve), true);
    const result = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
    assert.equal(result.devDependencies.cypress, '16.2.0');
    assert.equal(result.devDependencies['@vitaliiboiko/magento-template-coverage'], '1.2.0');
    assert.equal(result.devDependencies.unrelated, '3.0.0');
    assert.deepEqual(result.nyc, {include: ['keep']});
    assert.equal(syncDependencies(directory, selected, resolve), false);
    assert.equal(resolutions, 1, 'An unchanged rerun must not resolve dependencies again');
});

test('failed dependency resolution preserves the working manifest and lock', t => {
    const directory = workspace(t);
    manifests(directory);
    const files = ['package.json', 'package-lock.json'];
    const original = files.map(file => fs.readFileSync(path.join(directory, file), 'utf8'));
    assert.throws(() => syncDependencies(directory,
        {CYPRESS_VERSION: '16.2.0', TEMPLATE_COVERAGE_VERSION: '1.2.0'},
        () => { throw new Error('Registry unavailable'); }), /Registry unavailable/);
    assert.deepEqual(files.map(file => fs.readFileSync(path.join(directory, file), 'utf8')), original);
});

test('installer uses changed YAML versions and the runner image throughout its workflow', t => {
    const directory = workspace(t);
    for (const file of ['install.sh', 'bin/install', 'bin/common', 'bin/dependencies', 'bin/expose-tools', 'bin/application-domain']) {
        fs.mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
        fs.copyFileSync(path.join(root, file), path.join(directory, file));
    }
    fs.writeFileSync(path.join(directory, 'dependencies.yaml'), select(yaml, {MARKSHUST_DOCKER_MAGENTO_VERSION: '54.0.0', MAGENTO_VERSION: '2.4.9',
        PCOV_VERSION: '2.2.0', CYPRESS_VERSION: '16.2.0', TEMPLATE_COVERAGE_VERSION: '1.2.0',
        RUNNER_IMAGE: 'cypress/base:24.16.0'}));
    for (const child of ['bin', 'lib', 'env']) fs.mkdirSync(path.join(directory, '.runtime/docker-magento/compose', child), {recursive: true});
    fs.writeFileSync(path.join(directory, '.runtime/docker-magento/compose/bin/status'), '#!/bin/sh\n');
    // Keep the upstream entry points in the installer contract; Docker is mocked below.
    fs.writeFileSync(path.join(directory, '.runtime/docker-magento/compose/bin/setup-composer-auth'), '#!/bin/sh\nexec docker upstream-composer-auth\n');
    fs.writeFileSync(path.join(directory, '.runtime/docker-magento/compose/bin/setup-domain'), '#!/bin/sh\nexec docker upstream-domain "$@"\n');
    fs.writeFileSync(path.join(directory, '.runtime/docker-magento/compose/bin/clinotty'), '#!/bin/sh\nexec docker compose exec -T phpfpm "$@"\n');
    fs.writeFileSync(path.join(directory, '.runtime/docker-magento/compose/env/local.env'), 'TEST=1\n');
    const commands = path.join(directory, 'commands');
    fs.mkdirSync(commands);
    const log = path.join(directory, 'commands.jsonl');
    const script = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({command: require('node:path').basename(process.argv[1]), args,
    magento: process.env.MAGENTO_VERSION, pcov: process.env.PCOV_VERSION,
    cypress: process.env.CYPRESS_VERSION, templates: process.env.TEMPLATE_COVERAGE_VERSION,
    php: process.env.MAGELENS_PHP_IMAGE}) + '\\n');
if (args.includes('version')) console.log('2.24.4');
if (args.includes('--images')) console.log('markoshust/magento-php:8.5-fpm-1');
if (args.includes('--print')) console.log('https://shop.magelens.test/');
if (args.includes('--print-viewer')) console.log('https://shop.magelens.test:6080/');
`;
    for (const command of ['docker', 'git']) fs.writeFileSync(path.join(commands, command), script, {mode: 0o755});
    execFileSync('bash', ['install.sh', 'shop.magelens.test'], {cwd: directory, env: {...process.env, PATH: `${commands}:${process.env.PATH}`}, stdio: 'pipe'});
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(calls.some(call => call.command === 'git' && call.args.includes('refs/tags/54.0.0')));
    const sync = calls.find(call => call.args.includes('bin/sync-dependencies.cjs'));
    assert.ok(sync.args.includes('cypress/base:24.16.0'));
    assert.equal(sync.cypress, '16.2.0');
    assert.equal(sync.templates, '1.2.0');
    const build = calls.find(call => call.args.includes('build'));
    assert.equal(build.magento, '2.4.9');
    assert.equal(build.pcov, '2.2.0');
    assert.equal(build.php, 'markoshust/magento-php:8.5-fpm-1');
    assert.ok(calls.indexOf(sync) < calls.indexOf(build));
    const auth = calls.find(call => call.args.includes('upstream-composer-auth'));
    const volumeSetup = calls.find(call => call.args.includes('chown') && call.args.includes('/sock'));
    const phpStart = calls.find(call => call.args.includes('up') && call.args.at(-1) === 'phpfpm');
    assert.ok(volumeSetup && phpStart);
    assert.ok(volumeSetup.args.includes('run') && volumeSetup.args.includes('--no-deps'));
    assert.ok(calls.indexOf(volumeSetup) < calls.indexOf(phpStart), 'Socket ownership must be set before starting non-root PHP');
    assert.ok(phpStart.args.includes('--wait'), 'Wait for the PHP socket before Composer authentication');
    assert.ok(calls.indexOf(phpStart) < calls.indexOf(auth));
    const download = calls.find(call => call.args.includes('/application/docker/php/download-magento.sh'));
    const expose = calls.find(call => call.args.includes('run') && call.args.includes('workspace'));
    assert.ok(auth && download && expose);
    assert.ok(calls.indexOf(auth) < calls.indexOf(download));
    assert.ok(calls.indexOf(download) < calls.indexOf(expose), 'Source must be downloaded before changing the installation');
    const domain = calls.find(call => call.args.includes('upstream-domain'));
    assert.deepEqual(domain.args, ['upstream-domain', 'shop.magelens.test']);
    assert.ok(calls.indexOf(domain) > calls.indexOf(expose));
    assert.match(fs.readFileSync(path.join(directory, '.env'), 'utf8'), /^APPLICATION_DOMAIN=shop\.magelens\.test$/m);
    assert.ok(calls.some(call => call.args.includes('exec') && call.args.includes('runner') && call.args.includes('verify')));
    assert.ok(fs.existsSync(path.join(directory, '.runtime/installed')));
});

test('Compose inherits service images and PHP from the selected Mark Shust configuration', t => {
    if (spawnSync('docker', ['compose', 'version'], {stdio: 'ignore'}).status !== 0) return t.skip('Docker Compose CLI unavailable');
    const directory = workspace(t);
    for (const file of ['compose.yaml', 'dependencies.yaml', 'bin/common', 'bin/dependencies', 'bin/application-compose']) {
        fs.mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
        fs.copyFileSync(path.join(root, file), path.join(directory, file));
    }
    const upstream = path.join(directory, '.runtime/docker-magento/compose');
    fs.mkdirSync(upstream, {recursive: true});
    fs.writeFileSync(path.join(upstream, 'compose.yaml'), JSON.stringify({services: {
        app: {image: 'fixture/nginx:9.0'}, phpfpm: {image: 'fixture/php:8.5'},
        db: {image: 'fixture/db:12.0'}, redis: {image: 'fixture/cache:9.0'}, opensearch: {image: 'fixture/search:4.0'}
    }}));
    const config = JSON.parse(execFileSync('bash', ['bin/application-compose', 'config', '--format', 'json'], {cwd: directory, encoding: 'utf8'}));
    assert.equal(config.services.app.image, 'fixture/nginx:9.0');
    assert.equal(config.services.db.image, 'fixture/db:12.0');
    assert.equal(config.services.redis.image, 'fixture/cache:9.0');
    assert.equal(config.services.opensearch.image, 'fixture/search:4.0');
    assert.equal(config.services.phpfpm.build.args.PHP_IMAGE, 'fixture/php:8.5');
    assert.equal(config.services.phpfpm.environment.MAGENTO_VERSION, configured('MAGENTO_VERSION'));
    assert.equal(config.services.phpfpm.environment.APPLICATION_DOMAIN, 'magelens.test');
    assert.equal(config.services.phpfpm.environment.APPLICATION_HTTPS_PORT, '443');
    assert.equal(config.services.phpfpm.environment.CYPRESS_VIEW_PORT, '6080');
    assert.deepEqual(config.services.app.ports.map(port => [port.host_ip, port.published, port.target]),
        [['127.0.0.1', '80', 8000], ['127.0.0.1', '443', 8443], ['127.0.0.1', '6080', 8444]]);
    assert.equal(config.services.runner.build.args.RUNNER_IMAGE, configured('RUNNER_IMAGE'));
});
