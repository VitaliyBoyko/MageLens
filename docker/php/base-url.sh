#!/usr/bin/env bash
set -euo pipefail
cd /var/www/html
url="https://${APPLICATION_DOMAIN:-magelens.test}"
[[ "${APPLICATION_HTTPS_PORT:-443}" == 443 ]] || url+=":${APPLICATION_HTTPS_PORT}"
url+='/'
if [[ "${1:-}" == --print ]]; then
    printf '%s\n' "$url"
    exit 0
fi
if [[ "${1:-}" == --print-viewer ]]; then
    printf 'https://%s:%s/\n' "${APPLICATION_DOMAIN:-magelens.test}" "${CYPRESS_VIEW_PORT:-6080}"
    exit 0
fi
url=${1:-$url}
secure=0
[[ "$url" != https://* ]] || secure=1
php bin/magento config:set web/unsecure/base_url "$url"
php bin/magento config:set web/secure/base_url "$url"
php bin/magento config:set web/secure/use_in_frontend "$secure"
php bin/magento config:set web/secure/use_in_adminhtml "$secure"
# Let cookies follow the request host when switching between the local domain and Cypress.
php bin/magento config:set web/cookie/cookie_domain ''
php bin/magento cache:clean config
