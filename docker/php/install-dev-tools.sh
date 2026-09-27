#!/usr/bin/env bash
set -euo pipefail
# Match Mark Shust's bin/init development dependency, keeping it in vendor/.
if ! composer show markshust/magento2-module-disabletwofactorauth >/dev/null 2>&1; then
    composer require --dev markshust/magento2-module-disabletwofactorauth --prefer-dist --no-interaction --no-progress
fi
