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

for (const failure of ['', 'startup', 'diagnostics']) {
    test(`PHP setup ${failure ? `reports health-check failure when ${failure} fails` : 'recreates FPM after stopping web traffic'}`, () => {
        const result = spawnSync('bash', ['-c', `
            source "$1/bin/common"
            dc() {
                printf '%s\\n' "$*"
                case "$1" in
                    stop|run) return 0 ;;
                    up) [[ -z "$TEST_FAILURE" ]] ;;
                    ps) [[ "$*" != 'ps -a -q phpfpm' ]] || echo test-php-container ;;
                    logs) echo 'PHP access log'; [[ "$TEST_FAILURE" != diagnostics ]] ;;
                    *) return 99 ;;
                esac
            }
            docker() {
                echo 'Health-check diagnostic: stale PHP socket' >&2
                [[ "$TEST_FAILURE" != diagnostics ]]
            }
            start_php_for_setup
            echo continued
        `, 'test', root], {encoding: 'utf8', env: {...process.env, TEST_FAILURE: failure}});
        assert.equal(result.status, failure ? 1 : 0, result.stderr);
        assert.match(result.stdout, /^stop -t 60 app phpfpm\nrun --rm --no-deps --user root phpfpm chown/m);
        assert.match(result.stdout, /up -d --no-deps --force-recreate --wait --wait-timeout 60 phpfpm/);
        if (failure) {
            assert.match(result.stderr, /Health-check diagnostic: stale PHP socket/);
            assert.match(result.stderr, /PHP access log/);
            assert.match(result.stderr, /PHP-FPM could not start/);
            assert.doesNotMatch(result.stdout, /continued/);
        } else {
            assert.match(result.stdout, /continued/);
            assert.equal(result.stderr, '');
        }
    });
}
