#!/usr/bin/env bash
set -euo pipefail
pids=()
cleanup() { trap - EXIT TERM INT; kill "${pids[@]}" 2>/dev/null || true; wait || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
Xvfb "$DISPLAY" -screen 0 1600x1000x24 -nolisten tcp &
pids+=("$!")
for attempt in {1..50}; do
    xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && break
    sleep 0.1
done
xdpyinfo -display "$DISPLAY" >/dev/null
openbox --sm-disable >/tmp/magelens-openbox.log 2>&1 &
pids+=("$!")
xsetroot -solid '#202832'
xmessage -center -buttons '' 'MageLens Cypress

Waiting for a test run.
Start tests from your terminal with ./bin/run-coverage' &
pids+=("$!")
# LibVNCServer scans the file limit on connect; some Docker hosts set it to billions.
# Bound only this process so Cypress retains the container's normal limits.
(ulimit -n 1024; exec x11vnc -display "$DISPLAY" -localhost -rfbport 5900 -forever -shared -nopw -viewonly -noxdamage -quiet) &
pids+=("$!")
websockify --web=/usr/share/novnc 6080 localhost:5900 &
pids+=("$!")
wait -n "${pids[@]}"
exit 1
