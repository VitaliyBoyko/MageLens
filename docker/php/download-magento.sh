#!/usr/bin/env bash
set -euo pipefail
stage="/bootstrap/magento-${MAGENTO_VERSION}"
if [[ -f "$stage/.magelens-composer-ready" ]] && \
    composer --working-dir="$stage" show markshust/magento2-module-disabletwofactorauth >/dev/null 2>&1; then
    exit 0
fi
rm -f "$stage/.magelens-composer-ready"
if [[ ! -f "$stage/composer.json" ]]; then
    # Same package, repository and version selection as upstream bin/download.
    # Stage the download because src/ may already hold client code and data.
    composer create-project --repository=https://repo.magento.com/ \
        "magento/project-community-edition=${MAGENTO_VERSION}" "$stage" --no-install --no-interaction
fi
cd "$stage"
composer install --prefer-dist --no-interaction --no-progress
bash /application/docker/php/install-dev-tools.sh
[[ -f vendor/magento/framework/Component/ComponentRegistrar.php && ! -d app/code/Magento ]] || {
    echo 'Expected Composer-installed Magento packages in vendor/magento.' >&2; exit 1;
}
php /application/docker/php/sync-source.php inventory "$stage"
touch .magelens-composer-ready
