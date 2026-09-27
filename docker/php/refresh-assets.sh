#!/usr/bin/env bash
set -euo pipefail
cd /var/www/html
# Clear copied/instrumented assets; developer mode generates requested files on demand.
# Keep .htaccess and the deployment version in pub/static.
rm -rf pub/static/frontend pub/static/adminhtml var/view_preprocessed
php bin/magento cache:clean
