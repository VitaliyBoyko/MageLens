# Cypress-only Magento patches

The bundled blog demo temporarily applies two compatibility fixes while Cypress runs:

- [Session handling](magento-framework-session-cookie-race-41057.patch) prevents intermittent session loss during login and form submissions. See [Magento issue #41057](https://github.com/magento/magento2/issues/41057).
- [Admin forms](magento-admin-form-prototype.patch) keeps change tracking working when Cypress fills Magento Admin inputs.

These patches target **Magento 2.4.8-p5**. They are applied and reverted automatically, including after failed tests. No manual setup is needed. If a patch does not match your installed Magento version, the run stops; review compatibility before retrying.

`./bin/run-coverage` applies the patches before its automatic storefront homepage warm-up, after instrumentation and fixture preparation. Coverage starts afterward in a fresh browser with the existing test timeouts. A warm-up failure also reverts the patches. See [the run lifecycle](../../docs/coverage.md#run-lifecycle) for limits and diagnostics.

After a forcibly interrupted run, rerun `./bin/run-coverage` to recover automatically, or restore the Magento files without running tests:

```bash
./bin/application-compose run --rm --no-deps phpfpm bash /application/docker/php/cypress-patches.sh revert
```
