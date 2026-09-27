const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

// Run in the configured base runner image before building the Cypress image.
// Resolve in a temporary directory: a registry failure must not corrupt the
// project's current manifests or replace its installed node_modules.
function syncDependencies(root, env = process.env, execute = execFileSync) {
    const requested = {
        cypress: env.CYPRESS_VERSION,
        '@vitaliiboiko/magento-template-coverage': env.TEMPLATE_COVERAGE_VERSION
    };
    for (const [name, version] of Object.entries(requested)) {
        if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/.test(version || '')) {
            throw new Error(`Missing or invalid configured version for ${name}`);
        }
    }
    const manifestPath = path.join(root, 'package.json');
    const lockPath = path.join(root, 'package-lock.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;
    const matches = Object.entries(requested).every(([name, version]) =>
        manifest.devDependencies?.[name] === version &&
        lock?.packages?.['']?.devDependencies?.[name] === version &&
        lock?.packages?.[`node_modules/${name}`]?.version === version);
    if (matches) return false;

    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'magelens-dependencies-'));
    try {
        manifest.devDependencies = {...manifest.devDependencies, ...requested};
        fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
        if (lock) fs.copyFileSync(lockPath, path.join(temporary, 'package-lock.json'));
        execute('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
            {cwd: temporary, stdio: 'inherit'});
        const resolved = JSON.parse(fs.readFileSync(path.join(temporary, 'package-lock.json'), 'utf8'));
        for (const [name, version] of Object.entries(requested)) {
            if (resolved.packages?.[`node_modules/${name}`]?.version !== version ||
                resolved.packages?.['']?.devDependencies?.[name] !== version) {
                throw new Error(`npm did not resolve the configured ${name} ${version}`);
            }
        }
        for (const file of ['package.json', 'package-lock.json']) {
            const target = path.join(root, file);
            fs.copyFileSync(path.join(temporary, file), `${target}.magelens-tmp`);
            fs.renameSync(`${target}.magelens-tmp`, target);
        }
        return true;
    } finally {
        fs.rmSync(temporary, {recursive: true, force: true});
    }
}

if (require.main === module) {
    console.log(syncDependencies(process.cwd())
        ? 'Updated package.json and package-lock.json from dependencies.yaml.'
        : 'Browser dependency locks already match dependencies.yaml.');
}
module.exports = {syncDependencies};
