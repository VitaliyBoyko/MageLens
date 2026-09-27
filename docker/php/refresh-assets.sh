#!/usr/bin/env bash
set -euo pipefail
cd /var/www/html
# Keep .htaccess; remove only generated assets and preprocessed view files.
rm -rf pub/static/frontend pub/static/adminhtml var/view_preprocessed
php bin/magento cache:clean
configured_locales=$(php /application/docker/php/project.php locales)
mapfile -t locales <<< "$configured_locales"
php bin/magento setup:static-content:deploy -f --area frontend --area adminhtml "${locales[@]}"
