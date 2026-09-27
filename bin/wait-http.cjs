const url = `${process.env.CYPRESS_BASE_URL}/`;
(async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(5000)});
            if (response.ok) {
                console.log(`Magento ready: ${url}`);
                return;
            }
        } catch (_) { /* Magento/PHP-FPM may still be starting. */ }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Magento did not become ready at ${url}. Inspect ./bin/application-compose logs app phpfpm.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
