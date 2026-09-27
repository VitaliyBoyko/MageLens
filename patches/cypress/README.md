# Cypress-only Magento patches

The [demo blog hooks](../../src/app/code/Application/Blog/Test/MageLens/hooks.php) apply these patches to Magento files in `src/` before the Cypress suite and reverse them during cleanup, including failed runs. `docker/php/cypress-patches.sh` checks whether each patch can be applied or reversed and stops if it does not match the installed source.

`magento-framework-session-cookie-race-41057.patch` addresses a stale-cookie race after session regeneration by persisting a forwarding ID before releasing the old session and adopting that ID before validation. It targets `vendor/magento/framework/Session/SessionManager.php` in Magento 2.4.8-p5 / Framework 103.0.8-p5.

Related [Magento issue #41057](https://github.com/magento/magento2/issues/41057). Review the workaround when upgrading Magento.

`magento-admin-form-prototype.patch` keeps Magento Admin change tracking working when Cypress presents input elements from a different DOM prototype chain. It calls the existing change handler directly and uses the static Prototype class helper. It targets `lib/web/mage/adminhtml/form.js` in Magento 2.4.8-p5.

Changes to patches or patched source invalidate the PHP coverage manifest. After an interrupted run, the next coverage run reverses any applied patches during its initial cleanup. To restore them manually, run:

```bash
./bin/application-compose run --rm --no-deps phpfpm bash /application/docker/php/cypress-patches.sh revert
```
