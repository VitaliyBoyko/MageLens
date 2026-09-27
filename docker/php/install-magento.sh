#!/usr/bin/env bash
set -euo pipefail
cd /var/www/html
[[ -f .application-source-ready ]] || { echo 'Magento source is missing from src/. Rerun ./install.sh.' >&2; exit 1; }
as_app() { su -s /bin/bash app -c 'cd /var/www/html; exec "$@"' -- bash "$@"; }
if [[ -f .magelens-imported ]]; then
    as_app composer install --prefer-dist --no-interaction --no-progress
    as_app bash /application/docker/php/install-dev-tools.sh
    # Copied credentials must not make setup:upgrade connect to a remote shop.
    as_app php -r '
        if (is_file("app/etc/env.php")) {
            $env = require "app/etc/env.php";
            if (($env["db"]["connection"]["default"]["host"] ?? "") !== "db") {
                fwrite(STDERR, "Point src/app/etc/env.php at this local db service and import your database, or move env.php aside for a fresh local installation.\n");
                exit(1);
            }
        }'
fi
fresh=no
if [[ ! -f app/etc/env.php ]]; then
    fresh=yes
    as_app php bin/magento setup:install \
        --base-url="$(bash /application/docker/php/base-url.sh --print)" \
        --base-url-secure="$(bash /application/docker/php/base-url.sh --print)" --db-host=db --db-name=magento \
        --db-user=magento --db-password=magento --backend-frontname=admin \
        --admin-firstname=Application --admin-lastname=Developer --admin-email=application@example.test \
        --admin-user=application --admin-password=ApplicationOnly123456! --language=en_US \
        --currency=USD --timezone=UTC --use-rewrites=1 --search-engine=opensearch \
        --opensearch-host=opensearch --opensearch-port=9200 \
        --session-save=files --cache-backend=redis --cache-backend-redis-server=redis \
        --cache-backend-redis-db=0 --no-interaction
fi
modules=$(as_app php /application/docker/php/project.php)
if [[ -n "$modules" ]]; then
    mapfile -t new_modules <<< "$modules"
    as_app php bin/magento module:enable "${new_modules[@]}"
fi
as_app php bin/magento module:enable MarkShust_DisableTwoFactorAuth
as_app php bin/magento setup:upgrade
current_mode=$(as_app php -r '$env = require "app/etc/env.php"; echo $env["MAGE_MODE"] ?? "";')
if [[ "$current_mode" != developer ]]; then
    as_app php bin/magento deploy:mode:set developer
fi
as_app php bin/magento config:set twofactorauth/general/enable 0
if [[ "$fresh" == yes ]]; then as_app php /application/docker/php/configure-theme.php; fi
as_app bash /application/docker/php/base-url.sh
as_app php bin/magento config:set web/url/redirect_to_base 0
as_app php bin/magento config:set dev/static/sign 0
as_app php bin/magento config:set dev/js/minify_files 0
as_app php bin/magento config:set dev/js/merge_files 0
as_app php bin/magento config:set dev/js/enable_js_bundling 0
as_app php bin/magento config:set admin/usage/enabled 0
as_app php /application/docker/php/configure-admin.php
as_app php bin/magento cache:disable full_page block_html
as_app php bin/magento indexer:reindex
