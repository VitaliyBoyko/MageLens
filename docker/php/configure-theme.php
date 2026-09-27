<?php
require '/var/www/html/app/bootstrap.php';
require __DIR__ . '/project.php';
$bootstrap = Magento\Framework\App\Bootstrap::create(BP, $_SERVER);
$om = $bootstrap->getObjectManager();
$om->get(Magento\Framework\App\State::class)->setAreaCode('adminhtml');
$om->get(Magento\Theme\Model\Theme\Registration::class)->register();
$themes = [];
foreach ($om->create(Magento\Theme\Model\ResourceModel\Theme\Collection::class)->addFieldToFilter('area', 'frontend') as $theme) {
    foreach (project()['roots'] as $root) {
        if (str_starts_with('app/design/frontend/' . $theme->getThemePath(), $root . '/')) $themes[] = $theme;
    }
}
if (count($themes) === 1) {
    $om->get(Magento\Framework\App\Config\Storage\WriterInterface::class)->save('design/theme/theme_id', $themes[0]->getId());
    echo 'Enabled custom theme ', $themes[0]->getThemePath(), "\n";
}
