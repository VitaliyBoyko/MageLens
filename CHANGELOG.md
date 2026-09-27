# Release notes

## 1.0.6 — 2026-09-27

- Coverage runs reuse running services and unchanged browser instrumentation. They no longer restart containers, rewrite Magento configuration, or clear caches and static assets automatically.
- Use `--start`, `--refresh-cache`, `--refresh-assets`, and `--restart-php` when needed. Options can be combined.
- Coverage settings are explicit in `docker/php/env.php.sample` and merged into Magento's `env.php` during installation. HTML/PHTML and browser assets run without minification.
- Cypress uses your configured HTTPS domain. Source edits and selected theme changes are picked up without restarting PHP.

For an existing installation, rerun `./install.sh` once after updating, then use `./bin/run-coverage` as usual.

## 1.0.5 — 2026-09-27

- The Cypress runner recovers after an interrupted container shutdown, including during installation's SSL restart.
- Installation and coverage commands print service logs when a required container fails to start.

## 1.0.4 — 2026-09-27

- The bundled demo now selects its real storefront theme when no theme is configured. Reinstalling preserves your theme choices.
- PHP, JavaScript, and template reports follow the selected local themes and their parents. Inactive themes and `vendor` are excluded.
- Theme-specific demo content no longer prevents using another storefront theme.
- Static assets retain coverage instrumentation across repeated requests, fixing missing JavaScript and template hits.
- Magento's first-use generated classes no longer invalidate an otherwise valid PHP report.
- The storefront CSRF test now checks the rejection redirect without consuming its error message.
- Setup and patch documentation is shorter, and installation archives omit maintainer tests and release automation.
