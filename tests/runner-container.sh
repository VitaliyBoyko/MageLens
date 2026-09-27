#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# == 1 ]] || { echo "Usage: $0 RUNNER_IMAGE" >&2; exit 1; }
container="magelens-runner-check-$$"
cleanup() {
    local result=$?
    trap - EXIT
    if (( result != 0 )); then docker logs "$container" >&2 || true; fi
    docker rm -f "$container" >/dev/null 2>&1 || true
    exit "$result"
}
trap cleanup EXIT
docker run -d --name "$container" --init --user "$(id -u):$(id -g)" \
    --env HOME=/tmp --env DISPLAY=:107 --shm-size=1g \
    --mount "type=bind,source=$PWD/docker/runner/desktop.sh,target=/opt/magelens/desktop.sh,readonly" \
    --mount "type=bind,source=$PWD/docker/runner/healthcheck.cjs,target=/opt/magelens/healthcheck.cjs,readonly" \
    "$1" >/dev/null
ready() {
    local state
    for attempt in {1..30}; do
        state=$(docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' "$container")
        [[ "$state" != 'running healthy' ]] || return 0
        [[ "$state" == running* ]] || break
        sleep 1
    done
    echo "Runner did not recover: $state" >&2
    return 1
}
ready
# Starting a second desktop must not remove a live server's lock or socket.
if docker exec "$container" bash /opt/magelens/desktop.sh; then
    echo 'A second desktop unexpectedly started on an occupied display.' >&2
    exit 1
fi
docker exec "$container" node /opt/magelens/healthcheck.cjs
for shutdown in graceful forced forced; do
    if [[ "$shutdown" == graceful ]]; then
        docker stop -t 10 "$container" >/dev/null
        [[ "$(docker inspect --format '{{.State.ExitCode}}' "$container")" == 0 ]]
    else
        docker kill "$container" >/dev/null
        docker cp "$container:/tmp/.X107-lock" - >/dev/null
    fi
    docker start "$container" >/dev/null
    ready
    docker exec "$container" cypress verify
    echo "PASS: desktop, VNC, viewer, and Cypress recovered after $shutdown shutdown."
done
