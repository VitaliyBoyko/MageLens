#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../bin/common"
scratch=$(mktemp -d /tmp/magelens-domain-check.XXXXXX)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/bin"
cat > "$scratch/bin/magento" <<'PHP'
<?php
$file = '/tmp/domain-config.json';
$config = is_file($file) ? json_decode(file_get_contents($file), true) : [];
if ($argv[1] === 'config:set') $config[$argv[2]] = $argv[3];
file_put_contents($file, json_encode($config));
PHP
cat > "$scratch/check.sh" <<'BASH'
set -euo pipefail
script=/application/docker/php/base-url.sh
[[ "$(bash "$script" --print)" == https://store.magelens.test:8443/ ]]
[[ "$(bash "$script" --print-viewer)" == https://store.magelens.test:6090/ ]]
bash "$script"
php -r '$c = json_decode(file_get_contents("/tmp/domain-config.json"), true); if ($c["web/unsecure/base_url"] !== "https://store.magelens.test:8443/" || $c["web/secure/base_url"] !== "https://store.magelens.test:8443/" || $c["web/secure/use_in_frontend"] !== "1" || $c["web/secure/use_in_adminhtml"] !== "1") exit(1);'
bash "$script" http://app:8000/
php -r '$c = json_decode(file_get_contents("/tmp/domain-config.json"), true); if ($c["web/unsecure/base_url"] !== "http://app:8000/" || $c["web/secure/base_url"] !== "http://app:8000/" || $c["web/secure/use_in_frontend"] !== "0" || $c["web/secure/use_in_adminhtml"] !== "0" || $c["web/cookie/cookie_domain"] !== "") exit(1);'
bash "$script"
php -r '$c = json_decode(file_get_contents("/tmp/domain-config.json"), true); if ($c["web/secure/base_url"] !== "https://store.magelens.test:8443/" || $c["web/secure/use_in_adminhtml"] !== "1") exit(1);'
unset APPLICATION_DOMAIN APPLICATION_HTTPS_PORT
[[ "$(bash "$script" --print)" == https://magelens.test/ ]]
echo 'PASS: selected domain, custom ports, HTTP coverage mode, and HTTPS restoration.'
BASH
docker run --rm --user "$LOCAL_UID:$LOCAL_GID" \
    --mount "type=bind,source=$scratch,target=/var/www/html" \
    --mount "type=bind,source=$ROOT/docker,target=/application/docker,readonly" \
    --env APPLICATION_DOMAIN=store.magelens.test --env APPLICATION_HTTPS_PORT=8443 --env CYPRESS_VIEW_PORT=6090 \
    --entrypoint bash "magelens-php:${MAGENTO_VERSION}-pcov${PCOV_VERSION}-markshust${MARKSHUST_DOCKER_MAGENTO_VERSION}" \
    /var/www/html/check.sh
