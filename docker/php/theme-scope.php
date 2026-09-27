<?php
declare(strict_types=1);
require '/var/www/html/app/bootstrap.php';
$om = Magento\Framework\App\Bootstrap::create(BP, $_SERVER)->getObjectManager();
$om->get(Magento\Framework\App\State::class)->setAreaCode('adminhtml');
$design = $om->get(Magento\Framework\View\DesignInterface::class);
$factory = $om->get(Magento\Framework\View\Design\Theme\FlyweightFactory::class);
$registrar = $om->get(Magento\Framework\Component\ComponentRegistrar::class);
$themes = [$factory->create($design->getConfigurationDesignTheme('adminhtml'), 'adminhtml')];
foreach ($om->get(Magento\Store\Model\StoreManagerInterface::class)->getStores() as $store) {
    if ($store->getIsActive()) {
        $themes[] = $factory->create($design->getConfigurationDesignTheme('frontend', ['store' => $store]), 'frontend');
    }
}
$roots = [];
foreach ($themes as $theme) {
    while ($theme) {
        $directory = $registrar->getPath(Magento\Framework\Component\ComponentRegistrar::THEME, $theme->getFullPath());
        if ($directory && str_starts_with($directory, BP . '/app/design/')) {
            $roots[] = substr($directory, strlen(BP) + 1);
        }
        $theme = $theme->getParentTheme();
    }
}
$roots = array_values(array_unique($roots));
sort($roots);
echo json_encode($roots, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), "\n";
