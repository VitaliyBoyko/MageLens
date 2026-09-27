<?php
declare(strict_types=1);

function project(): array
{
    return json_decode(file_get_contents('/application/project.json'), true, flags: JSON_THROW_ON_ERROR);
}

if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    require '/var/www/html/app/bootstrap.php';
    if (($argv[1] ?? '') === 'locales') {
        $om = \Magento\Framework\App\Bootstrap::create(BP, $_SERVER)->getObjectManager();
        $config = $om->get(\Magento\Framework\App\Config\ScopeConfigInterface::class);
        $locales = [$config->getValue('general/locale/code')];
        foreach ($om->get(\Magento\Store\Model\StoreManagerInterface::class)->getStores() as $store) {
            $locales[] = $config->getValue('general/locale/code', 'store', $store->getId());
        }
        foreach (array_unique($locales) as $locale) {
            if (!is_string($locale) || !preg_match('/^[a-z]{2,3}_[A-Z]{2}$/D', $locale)) throw new RuntimeException('Invalid configured locale');
            echo $locale, "\n";
        }
        exit;
    }
    $configured = is_file(BP . '/app/etc/config.php') ? require BP . '/app/etc/config.php' : [];
    $roots = project()['roots'];
    $registrar = new \Magento\Framework\Component\ComponentRegistrar;
    foreach ($registrar->getPaths(\Magento\Framework\Component\ComponentRegistrar::MODULE) as $name => $directory) {
        foreach ($roots as $root) {
            if (str_starts_with($directory, BP . '/' . $root . '/') && !array_key_exists($name, $configured['modules'] ?? [])) {
                echo $name, "\n";
                break;
            }
        }
    }
}
