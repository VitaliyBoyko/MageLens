const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');

for (const failure of ['', 'runner', 'logs']) {
    test(`dependency startup ${failure ? `reports a failure even when ${failure} fails` : 'continues after all services are ready'}`, () => {
        const result = spawnSync('bash', ['-c', `
            source "$1/bin/common"
            dc() {
                case "$1" in
                    up) [[ -z "$TEST_FAILURE" ]] ;;
                    ps) echo 'runner exited (1)' ;;
                    logs) echo 'Xvfb startup diagnostic'; [[ "$TEST_FAILURE" != logs ]] ;;
                    *) return 99 ;;
                esac
            }
            start_dependencies
            echo continued
        `, 'test', root], {encoding: 'utf8', env: {...process.env, TEST_FAILURE: failure}});
        assert.equal(result.status, failure ? 1 : 0, result.stderr);
        if (failure) {
            assert.match(result.stderr, /runner exited/);
            assert.match(result.stderr, /Xvfb startup diagnostic/);
            assert.match(result.stderr, /required service could not start/);
            assert.doesNotMatch(result.stdout, /continued/);
        } else {
            assert.equal(result.stdout.trim(), 'continued');
            assert.equal(result.stderr, '');
        }
    });
}
