# Release notes

## 1.0.12 — 2026-10-09

- Updated Magento template coverage to 1.1.1 so instrumented Underscore and Magento literal templates render safely while the execution collector is unavailable.
- Cypress reconnects restore a deleted template execution helper in retained documents.

When updating from v1.0.11, replace the project files and rerun `./install.sh` once to install the updated template coverage dependency, then use `./bin/run-coverage` as usual.

## 1.0.11 — 2026-10-06

- JavaScript coverage excludes Cypress specs and support directories from instrumentation and report totals, including stale records from older releases.
- Unvisited application JavaScript still contributes zero-hit coverage, and source integrity checks still include test files.

When updating from v1.0.10, replace the project files and run `./bin/run-coverage` directly; rerunning the installer is unnecessary. The next run rebuilds instrumentation automatically.

## 1.0.10 — 2026-10-06

- Homepage warm-up no longer times out because Magento initialization markers remain after assets have finished loading. Unfinished browser requests and RequireJS modules still block preparation and produce diagnostics.

When updating from v1.0.9, replace the project files and run `./bin/run-coverage` directly; rerunning the installer is unnecessary.

## 1.0.9 — 2026-10-06

- Reinstalling recreates PHP-FPM before Composer setup, allowing recovery from unhealthy containers and stale source mounts.
- Installation failures now show Docker health-check results and PHP socket connection errors alongside container logs.

If installation failed at PHP-FPM startup, replace the project files and rerun `./install.sh`. Existing source, Composer credentials and database volumes are retained.

## 1.0.8 — 2026-10-06

- `./bin/run-coverage` automatically warms the storefront homepage and its dynamic assets before testing, reducing first-run timeouts after installation or an asset refresh.
- Warm-up has bounded timeouts and reports unfinished requests and RequireJS modules when preparation fails.
- Coverage starts afterward in a fresh browser session, with the existing test timeouts and two-command workflow.

When updating from v1.0.7, replace the project files and run `./bin/run-coverage` directly; rerunning the installer is unnecessary.

## 1.0.7 — 2026-09-27

- Demo tests wait for asynchronous storefront and theme templates to render before checking the page.
- An interrupted Admin scenario no longer changes the storefront scenario's expected article count.

When updating from v1.0.6, replace the project files and run `./bin/run-coverage` directly; rerunning the installer is unnecessary.

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
