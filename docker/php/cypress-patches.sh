#!/usr/bin/env bash
set -euo pipefail
# Patch paths are relative to the Composer-installed Magento project.
cd /var/www/html
for patch in /cypress-patches/*.patch; do
    [[ -f "$patch" ]] || continue
    case "${1:-}" in
        apply)
            if git apply --unidiff-zero --check "$patch" 2>/dev/null; then
                git apply --unidiff-zero "$patch"
                printf 'Applied Cypress-only patch: %s\n' "$(basename "$patch")"
            elif git apply --unidiff-zero --reverse --check "$patch" 2>/dev/null; then
                printf 'Cypress-only patch already applied: %s\n' "$(basename "$patch")"
            else
                printf 'Patch does not match this Magento version: %s. Review it before running Cypress.\n' "$patch" >&2
                exit 1
            fi
            ;;
        revert)
            if git apply --unidiff-zero --reverse --check "$patch" 2>/dev/null; then
                git apply --unidiff-zero --reverse "$patch"
            elif ! git apply --unidiff-zero --check "$patch" 2>/dev/null; then
                printf 'Cannot safely restore %s; inspect the Magento file before continuing.\n' "$patch" >&2
                exit 1
            fi
            ;;
        *) printf 'Usage: cypress-patches.sh apply|revert\n' >&2; exit 2 ;;
    esac
done
