const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function workflow(t, args = [], failure = '', interrupted = false) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'magelens-workflow-'));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    for (const name of ['bin', '.runtime', 'coverage']) fs.mkdirSync(path.join(directory, name));
    fs.copyFileSync(path.resolve(__dirname, '../bin/run-coverage'), path.join(directory, 'bin/run-coverage'));
    fs.writeFileSync(path.join(directory, '.runtime/installed'), '2\n');
    if (interrupted) fs.writeFileSync(path.join(directory, '.runtime/hooks-active'), '');
    fs.writeFileSync(path.join(directory, 'bin/common'), `
set -euo pipefail
ROOT=$PWD
preflight() { :; }
say() { :; }
fail() { echo "$*" >&2; exit 1; }
lock_workflow() { mkdir .runtime/workflow.lock; }
dc() {
    printf '%s\\n' "$*" >> calls
    case "$*" in
        *theme-scope.php) echo '[]' ;;
        *project-hooks.php\\ prepare) echo '{}' ;;
        *collection.php\\ start) touch coverage/.active-run ;;
        *collection.php\\ stop|*report.php) rm -f coverage/.active-run ;;
        *run-browser.cjs) [[ -z "$TEST_FAILURE" ]] || return 23 ;;
    esac
}
`);
    const result = spawnSync('bash', ['bin/run-coverage', ...args], {
        cwd: directory, encoding: 'utf8', env: {...process.env, TEST_FAILURE: failure},
    });
    const calls = fs.existsSync(path.join(directory, 'calls')) ? fs.readFileSync(path.join(directory, 'calls'), 'utf8') : '';
    assert.equal(fs.existsSync(path.join(directory, '.runtime/workflow.lock')), false);
    assert.equal(fs.existsSync(path.join(directory, 'coverage/.active-run')), false);
    return {...result, calls, directory};
}

test('default run preserves running services, configuration and caches', t => {
    const result = workflow(t);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.calls, /^(up|run|stop|restart) |cache:|config:set|refresh-assets|base-url/m);
    assert.equal((result.calls.match(/project-hooks.php cleanup/g) || []).length, 1);
    assert.match(result.calls, /report.php/);
    assert.match(result.calls, /finalize.cjs/);
});

test('refreshes run only when requested', t => {
    const result = workflow(t, ['--start', '--refresh-assets', '--refresh-cache', '--restart-php']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.calls, /^up /m);
    assert.match(result.calls, /^restart -t 60 phpfpm$/m);
    assert.match(result.calls, /refresh-assets.sh/);
    assert.doesNotMatch(result.calls, /cache:clean/, 'Asset refresh already cleans caches');
    const cache = workflow(t, ['--refresh-cache']);
    assert.match(cache.calls, /cache:clean/);
    assert.doesNotMatch(cache.calls, /refresh-assets.sh/);
});

test('failed tests close collection and clean fixtures without publishing reports', t => {
    const result = workflow(t, [], 'cypress', true);
    assert.equal(result.status, 23, result.stderr);
    assert.equal((result.calls.match(/project-hooks.php cleanup/g) || []).length, 2, 'Recover interrupted fixtures and clean current fixtures');
    assert.equal((result.calls.match(/collection.php stop/g) || []).length, 2);
    assert.doesNotMatch(result.calls, /report.php|finalize.cjs/);
    assert.equal(fs.existsSync(path.join(result.directory, '.runtime/hooks-active')), false);
});

test('help and invalid options do not touch the environment', t => {
    assert.equal(workflow(t, ['--help']).calls, '');
    const result = workflow(t, ['--unknown']);
    assert.equal(result.status, 1);
    assert.equal(result.calls, '');
});
