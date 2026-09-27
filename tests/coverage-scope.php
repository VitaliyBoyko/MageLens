<?php
declare(strict_types=1);
require '/application/docker/php/manifest.php';
require '/opt/report/vendor/autoload.php';

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$expected = array_map(static fn(string $file): string => '/var/www/html/' . $file, [
    'app/code/root.php', 'app/code/Magento/Local/registration.php',
    'app/code/Magento/Local/Setup/Upgrade.php', 'app/code/Magento/Local/Test/Example.php',
    'app/design/frontend/Magento/local/templates/example.phtml',
]);
$scope = array_keys(applicationIdentity()['scope']);
sort($expected, SORT_STRING);
check($scope === $expected, 'PHP scope must include every source file and exclude vendor');
foreach ($scope as $file) check(preg_match(ini_get('pcov.exclude'), $file) === 0, "PCOV excludes $file");

$identity = applicationIdentity()['identity']['id'];
mkdir('/var/www/html/generated/code/Scope', 0755, true);
file_put_contents('/var/www/html/generated/code/Scope/Factory.php', '<?php class ScopeFactory {}');
check(applicationIdentity()['identity']['id'] === $identity, 'First-use generated code must not invalidate scoped coverage');
$source = '/var/www/html/app/code/root.php';
$original = file_get_contents($source);
file_put_contents($source, $original . "\n// source edit\n");
check(applicationIdentity()['identity']['id'] !== $identity, 'Actual source changes must still invalidate coverage');
file_put_contents($source, $original);

pcov\start();
require '/var/www/html/app/code/Magento/Local/registration.php';
require '/var/www/html/vendor/magento/example/vendor.php';
pcov\stop();
$hits = pcov\collect();
check(in_array(1, $hits['/var/www/html/app/code/Magento/Local/registration.php'] ?? [], true), 'Registration execution is missing');
check(!isset($hits['/var/www/html/vendor/magento/example/vendor.php']), 'Vendor execution leaked into coverage');

$filter = new SebastianBergmann\CodeCoverage\Filter;
foreach ($scope as $file) $filter->includeFile($file);
$coverage = new SebastianBergmann\CodeCoverage\CodeCoverage(
    (new SebastianBergmann\CodeCoverage\Driver\Selector)->forLineCoverage($filter), $filter
);
$coverage->includeUncoveredFiles();
$coverage->append(SebastianBergmann\CodeCoverage\Data\RawCodeCoverageData::fromXdebugWithoutPathCoverage($hits), 'scope regression');
(new SebastianBergmann\CodeCoverage\Report\Clover)->process($coverage, '/tmp/scope-clover.xml');
$clover = simplexml_load_file('/tmp/scope-clover.xml');
foreach ($scope as $file) {
    $reported = $clover->xpath('//file[@name="' . $file . '"]/line[@type="stmt"]');
    check((bool) $reported, "PHP report omitted executable source: $file");
    $executed = array_filter($reported, static fn(SimpleXMLElement $line): bool => (int) $line['count'] > 0);
    check((bool) $executed === str_ends_with($file, '/registration.php'), "Incorrect execution count: $file");
}
echo "PASS: real PCOV registration hits and uncovered root, Setup, Test, and theme files reach the PHP report.\n";
