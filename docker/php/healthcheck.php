<?php
declare(strict_types=1);

$socket = @fsockopen('unix:///sock/phpfpm.sock', -1, $number, $message, 2);
if ($socket === false) {
    fwrite(STDERR, "Cannot connect to PHP-FPM at /sock/phpfpm.sock: $message ($number)\n");
    exit(1);
}
fclose($socket);
