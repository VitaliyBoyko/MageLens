<p align="center">
  <img src="assets/magelens.svg" alt="MageLens logo" width="320">
</p>

# MageLens

**Quickly bootstrap Magento with code coverage.** MageLens sets up a local Magento Open Source environment in Docker and collects PHP, JavaScript, and HTML template coverage from a single Cypress run.

Run the installer, run the tests, and open one report to see which parts of your application executed. PHP, Composer, Node, Cypress, and the reporting tools run in containers.

The included [blog module](src/app/code/Application/Blog/README.md) provides an optional demonstration application and Cypress suite. The badges are updated after each successful coverage run.

<!-- coverage-badges:start -->
Run `./bin/run-coverage` to generate coverage reports and badges for your project.
<!-- coverage-badges:end -->

## Quick start

Run this inside the empty directory you want to use for MageLens:

```bash
wget -qO- https://github.com/VitaliyBoyko/MageLens/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 && ./install.sh
```

If you have already cloned or downloaded MageLens, run `./install.sh` from its project directory.

Then generate coverage reports:

```bash
./bin/run-coverage
```

The installer asks for a test domain, defaulting to `magelens.test`, and saves it as `APPLICATION_DOMAIN` in `.env`. It downloads Magento, dependencies, and the Cypress browser; allow several minutes. To use an existing project, [copy its source before installing](#copy-a-complete-magento-project).

With the default domain and ports:

| Open | Location |
| --- | --- |
| Magento storefront | https://magelens.test/ |
| Magento Admin | https://magelens.test/admin/ |
| Demonstration blog | https://magelens.test/blog/ |
| Live Cypress runner | https://magelens.test:6080/ |
| Combined coverage report, after a successful test run | `coverage/index.html` on your machine |

Fresh installations create the Admin account `application` / `ApplicationOnly123456!`. Demo features and usage are documented in the [blog README](src/app/code/Application/Blog/README.md).

Open the live runner before starting `./bin/run-coverage` to watch the Cypress window. The viewer is read-only. Use your selected domain in these URLs if you changed it during setup.

## Requirements

- Docker Engine/Desktop with Compose **2.24.4+**, running Linux containers; Git, Bash, wget, and tar.
- Linux or macOS. Allocate at least **6 GB RAM** to Docker (8 GB recommended) and roughly **15 GB free disk** for the first build.
- Internet access for container images, Composer/npm dependencies, and Cypress browser download.
- Magento Marketplace public/private keys for `repo.magento.com`.
- Free local ports **80**, **443**, and **6080**. Configure `APPLICATION_PORT`, `APPLICATION_HTTPS_PORT`, and `CYPRESS_VIEW_PORT` in `.env` to use different ports.

Installation uses Mark Shust's `bin/setup-composer-auth`. It reuses Composer credentials from the container or host, or asks for **Username** (public key) and **Password** (private key). Credentials are stored in the local `composerdata` Docker volume. To configure them separately after the PHP service starts, run `bin/setup-composer-auth`.

Mark Shust's `bin/setup-domain` adds the domain to your hosts file and configures a trusted local HTTPS certificate. Its setup scripts request your system password when needed. The application and live viewer bind to `127.0.0.1`.

## Coverage reports

`./bin/run-coverage` runs the project's Cypress suite and generates three reports:

| Coverage | What it measures | Local report |
| --- | --- | --- |
| PHP | Executable PHP and `.phtml` lines reached by real Magento HTTP requests, collected with PCOV | `coverage/php/index.html` |
| JavaScript | Instrumented browser execution, collected with Istanbul and Cypress | `coverage/js/index.html` |
| HTML templates | Executed bindings and template expressions, with DOM presence reported separately | `coverage/templates/index.html` |

Open `coverage/index.html` directly in your browser for the combined view. Each successful full run also refreshes the four SVG badges in `coverage/badges/` and the managed badge section in this README. Reports are generated locally and are ignored by Git; the badges can be committed. Archive `coverage/` to share the browsable reports.

Coverage includes every PHP/`.phtml`, JavaScript `.js`, and HTML template file under `src/app/code/`, `src/app/design/frontend/`, and `src/app/design/adminhtml/`. Files not executed by the browser suite remain uncovered, including setup and test helpers that run only through CLI.

Read the [coverage guide](docs/coverage.md) for report semantics, collection details, and adding tests and fixtures.

## Magento environment

MageLens extends the Compose services from the selected [Mark Shust Docker Magento](https://github.com/markshust/docker-magento) release with local mounts and coverage tooling. That release selects PHP, nginx, MariaDB, OpenSearch, and the cache service together. A separate image supplies the Cypress runner.

Magento is installed through Composer. Its modules, framework, and themes live in `src/vendor/magento/`; client modules live in `src/app/code/`. Magento runs in developer mode, generating code and static assets on demand, with page and block caches disabled for coverage collection.

Following Mark Shust's development setup, MageLens installs [DisableTwoFactorAuth](https://github.com/markshust/magento2-module-disabletwofactorauth) as a Composer development dependency and turns off Admin 2FA for this local environment. Cypress can sign in with the Admin username and password.

## Dependency versions

Edit **[dependencies.yaml](dependencies.yaml)**, then rerun:

```bash
./install.sh
```

This is the single place to choose the main dependency versions:

| Component | YAML setting |
| --- | --- |
| Magento Open Source | `MAGENTO_VERSION` |
| Mark Shust Docker Magento, including its PHP and service images | `MARKSHUST_DOCKER_MAGENTO_VERSION` |
| [PCOV fork](https://github.com/VitaliyBoyko/pcov) / PIE installer | `PCOV_VERSION` / `PIE_VERSION` |
| Cypress | `CYPRESS_VERSION` |
| [Magento template coverage](https://github.com/VitaliyBoyko/magento-template-coverage) | `TEMPLATE_COVERAGE_VERSION` |
| Cypress runner's Node and browser system dependencies | `RUNNER_IMAGE` |

Use exact release versions and keep values quoted. `RUNNER_IMAGE` is an image with a version tag. Select a Mark Shust release whose PHP and services are compatible with your Magento version.

The installer synchronizes Cypress and template coverage versions in `package.json` and `package-lock.json`. Commit those updated files alongside `dependencies.yaml`.

For installations created by MageLens, changing `MAGENTO_VERSION` updates Magento while preserving client modules, configuration, media, and the database. Installation stops if an update conflicts with local edits. Back up the database before upgrading; Magento setup can change its schema. Downgrades require a separate checkout and database.

For a copied project, manage Magento dependencies through its own `composer.json` and `composer.lock`. Review the demo's [Cypress patches](patches/cypress/README.md) when changing Magento versions.

## Work with the source

After installation, Magento's full source is available in **`src/`** and bind-mounted into Docker, so your IDE can browse client modules in `app/code/` and core packages in `vendor/`. Custom module and theme namespaces are tracked; Composer dependencies remain ignored.

### Copy custom modules or themes

Copy them into their normal Magento locations, for example `src/app/code/YourVendor/YourModule` or `src/app/design/frontend/YourVendor/your-theme`, then run:

```bash
./install.sh
./bin/run-coverage
```

The installer enables newly discovered modules and preserves explicitly disabled modules. Add tests under `cypress/e2e/` or inside a module's `Test/Cypress/` directory. A fresh installation selects a local storefront theme automatically when exactly one is available. Existing theme selection is preserved.

### Copy a complete Magento project

Before the first installation, place your complete project in `src/`, including `composer.json`, `composer.lock`, `bin/magento`, and `app/bootstrap.php`. Remove the bundled example module and theme if you do not want them in your project. MageLens installs dependencies from your `composer.lock` and adds the development 2FA module if it is missing. Provide credentials for any private Composer repositories your project uses.

For a fresh local database, omit the copied `app/etc/env.php`. To use existing data, import your database into the local `db` service and configure `env.php` for the local services before running `./install.sh`. The database host must be `db`.

Rerun `./install.sh` after module or theme changes to refresh setup and static assets. See the [coverage guide](docs/coverage.md#use-your-project) for adding scenarios and optional test fixtures.

## Everyday commands

Run these from the repository root:

```bash
./install.sh                              # install or refresh, retaining existing data
./install.sh shop.test                    # configure a different local domain
./bin/run-coverage                        # full suite, fresh reports, and badges
./bin/application-compose logs app phpfpm # inspect nginx and PHP logs
./bin/application-compose stop            # stop this project's services
bin/start                                 # start the installed environment
bin/magento cache:clean
bin/composer --version
bin/bash
bin/status
```

Installation makes Mark Shust's command-line tools available in `bin/`, connected to this project's Docker services. If you have npm on the host, `npm run cy:coverage` runs the coverage command.

The default Docker project name is `magelens`. To run multiple copies, set a unique `COMPOSE_PROJECT_NAME`, `APPLICATION_DOMAIN`, and host ports in each `.env` before installing. Keep the project name unchanged when reusing its database volumes.

Rerun `./install.sh` to resume interrupted setup or rebuild after Dockerfile changes. Existing database contents, configuration, and media are preserved.

Wait for coverage to finish before browsing manually: the run temporarily uses Docker's internal URL and instrumented source copies. See the [coverage guide](docs/coverage.md#run-lifecycle) for cleanup and recovery.

`./bin/application-compose down -v` deletes this project's Docker volumes, including its database and stored Composer credentials. Source files remain in `src/`. For a fresh database, back up wanted data, run that command, remove `src/app/etc/env.php`, and rerun `./install.sh`.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/code/` | Client modules |
| `src/app/design/frontend/`, `src/app/design/adminhtml/` | Local themes |
| `src/vendor/` | Composer dependencies, including Magento core |
| `install.sh`, `compose.yaml`, `docker/` | Installation and Docker services |
| [dependencies.yaml](dependencies.yaml) | Dependency version settings |
| `bin/run-coverage` | Run the Cypress suite and generate coverage |
| `cypress/`, module `Test/Cypress/` directories | Project scenarios and browser coverage collectors |
| `coverage/` | Generated reports and badges |
| [Blog demo](src/app/code/Application/Blog/README.md) | Example application exercising all three collectors |
| [Coverage guide](docs/coverage.md) | Collector details and customization |
