# MageLens coverage

Run `./bin/run-coverage` from the repository root, then open `coverage/index.html`. The command runs the full Cypress suite and generates PHP, JavaScript, and HTML template reports. See the [quick start](../README.md#quick-start) for installation.

## Coverage scope

Coverage includes all supported files under these source directories:

- `src/app/code/`
- `src/app/design/frontend/`
- `src/app/design/adminhtml/`

PHP and `.phtml` files appear in the PHP report, `.js` files in the JavaScript report, and `.html` files in the template report. Files are included regardless of namespace or purpose. Unexecuted files remain uncovered, including setup and test helpers that run only through CLI. Composer packages under `src/vendor/` are outside this scope.

Instrumentation uses disposable copies under `.runtime/app/`. Each run verifies that the original source files are unchanged. Symlinked source files and directories are unsupported.

## Run lifecycle

Each run stops PHP-FPM, clears previous coverage artifacts, prepares instrumented source copies, starts the application, and clears generated static assets before Cypress runs. Developer mode generates the requested JavaScript, CSS, and templates on demand. Installation and coverage share a lock, so run one command at a time.

The suite temporarily uses Docker's internal `http://app:8000/` URL. Cleanup restores HTTPS on your selected domain and plain source copies, then clears instrumented static assets, including after test failures. Wait for the command to finish before browsing the application manually.

The combined report and badges are published after all tests pass and the coverage records and source checks succeed. Skipped or pending tests prevent publication. The README badge section is marked pending when collection starts.

If a process is forcibly terminated, check for active installation or coverage processes before removing `.runtime/workflow.lock` and rerunning the command. For the demo's patch recovery command, see [Cypress patch notes](../patches/cypress/README.md).

## Watch a test run

Open `https://magelens.test:6080/`, then start `./bin/run-coverage` in your terminal. The viewer shows the Cypress browser as tests execute. Between runs, it displays a waiting screen. Viewing is read-only, so watching a run does not send mouse or keyboard input to the tests.

Use your configured `APPLICATION_DOMAIN` and `CYPRESS_VIEW_PORT` if they differ from the defaults. The viewer starts with the environment and is also started automatically by the coverage command.

## PHP coverage

[VitaliyBoyko/pcov](https://github.com/VitaliyBoyko/pcov) collects PHP execution from Magento HTTP requests associated with the current Cypress run. The browser sends a run token in an HttpOnly cookie; direct test requests can use the `X-Application-Coverage` header. CLI execution is outside the collection scope.

The PHP report measures executable lines. Unvisited files are included through static analysis with zero hits. `phpunit/php-code-coverage` generates HTML and Clover reports.

Collection starts in full-discovery mode. If requests load every scoped PHP file, the reporter saves an executable-line manifest under `.runtime/pcov/`. Later runs can reuse that manifest while recording fresh execution hits. Changes to source, configuration, dependencies, or the PHP/PCOV environment trigger full discovery again. Projects with files that are never loaded by HTTP requests remain in full-discovery mode.

Magento GET export caching is enabled for eligible requests when a complete manifest is available. Inspect `coverage/php/coverage-summary.json` for collection mode, request metadata, and cache counts. The cache reuses serialized exports while requests continue to execute PHP.

## JavaScript coverage

`istanbul-lib-instrument` adds execution counters to every `.js` file under the source directories. Cypress collects each page's counters through `@cypress/code-coverage`, and nyc generates the reports.

Files that are never loaded retain zero-hit counters from instrumentation. The report combines these with execution observed during the current suite.

## HTML template coverage

[@vitaliiboiko/magento-template-coverage](https://github.com/VitaliyBoyko/magento-template-coverage) inventories and instruments `.html` templates, collects browser observations, and generates the template report. The report contains directory totals and per-file source views.

The template badge measures **executable template lines**: starting lines of bindings and expressions that execute. Static markup has no execution denominator. A Knockout event binding hit records binding evaluation; it does not prove that its handler ran.

**DOM presence** is reported separately. Hidden elements count as present, while fetching HTML alone does not. Templates with unsupported execution syntax remain visible with an explanation of the available DOM coverage.

## Use your project

Follow the [source setup instructions](../README.md#work-with-the-source), then add Cypress scenarios in `cypress/e2e/**/*.cy.js` or a module's `Test/Cypress/**/*.cy.js`. All matching scenarios run with `./bin/run-coverage`.

Rerun `./install.sh` after adding modules, changing setup code or themes, or updating dependencies. Each coverage run refreshes its source copies and scope automatically.

Modules can provide optional fixture hooks in `Test/MageLens/hooks.php`:

| Action | When it runs | Expected output |
| --- | --- | --- |
| `before` | Before application startup, with PHP-FPM stopped | Optional diagnostic output |
| `prepare` | After the application is ready, before Cypress | One JSON value on stdout; diagnostics on stderr |
| `cleanup` | Before preparation and when the run exits | Optional diagnostic output; safe to repeat |

Cypress receives each module's `prepare` result through `Cypress.expose('projectFixtures')[moduleName]`. The [blog hooks](../src/app/code/Application/Blog/Test/MageLens/hooks.php) provide an example of fixture creation and cleanup.

## Reports and artifacts

Detailed HTML reports live in `coverage/php/`, `coverage/js/`, and `coverage/templates/`. `coverage/summary.json` records the run ID, generation time, and displayed metrics.

For collection details, inspect PHP records under `coverage/raw/php/<run-id>/`, template observations under `coverage/raw/templates/`, and JavaScript counters in `.nyc_output/out.json`. Each run creates fresh execution records.

Reports and raw artifacts are ignored by Git. The SVGs in `coverage/badges/` can be committed with the README. To share browsable reports, copy the entire `coverage/` directory so relative links continue to work.
