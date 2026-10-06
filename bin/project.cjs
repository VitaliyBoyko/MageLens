const fs = require('node:fs');
const path = require('node:path');

function directories(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).filter(entry => {
        if (entry.isSymbolicLink()) throw new Error(`Symlinked source is unsupported: ${path.join(directory, entry.name)}`);
        return entry.isDirectory();
    }).map(entry => entry.name);
}

function discover(source = 'src') {
    const roots = ['app/code', 'app/design/frontend', 'app/design/adminhtml'].filter(root => {
        const directory = `${source}/${root}`;
        if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Symlinked source is unsupported: ${directory}`);
        return fs.existsSync(directory) && fs.statSync(directory).isDirectory();
    });
    const modules = directories(`${source}/app/code`).flatMap(vendor => directories(`${source}/app/code/${vendor}`).flatMap(name => {
        const root = `app/code/${vendor}`;
        const directory = `${root}/${name}`;
        const definition = `${source}/${directory}/etc/module.xml`;
        if (!fs.existsSync(definition)) return [];
        const moduleName = fs.readFileSync(definition, 'utf8').match(/<module\b[^>]*\bname=["']([A-Za-z][A-Za-z0-9_]+)["']/)?.[1];
        if (!moduleName) throw new Error(`Missing Magento module name: ${definition}`);
        return [{name: moduleName, root: directory}];
    }));
    return {roots, modules};
}

function specPatterns() {
    return ['cypress/e2e/**/*.cy.js', ...discover().modules.map(module => `src/${module.root}/Test/Cypress/**/*.cy.js`)];
}

function isCypressJavaScript(file) {
    const normalized = file.replaceAll('\\', '/');
    return normalized.endsWith('.js') && (normalized.endsWith('.cy.js')
        || /(?:^|\/)(?:Test\/Cypress|cypress)\//.test(normalized));
}

function withThemeRoots(project, themeRoots, source = 'src') {
    if (!Array.isArray(themeRoots)) throw new Error('Expected selected theme directories');
    for (const root of themeRoots) {
        if (typeof root !== 'string' || !/^app\/design\/(frontend|adminhtml)\/[^/.][^/]*\/[^/.][^/]*$/.test(root)
            || !fs.existsSync(`${source}/${root}/theme.xml`)) {
            throw new Error(`Invalid selected theme directory: ${root}`);
        }
    }
    return {...project, roots: [...project.roots.filter(root => root === 'app/code'), ...new Set(themeRoots.sort())]};
}

function files(root) {
    return fs.readdirSync(root, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
        const file = path.join(root, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Symlinked source is unsupported: ${file}`);
        return entry.isDirectory() ? files(file) : [file];
    });
}

function writeRuntime(project, mountRoots = project.roots) {
    fs.mkdirSync('.runtime', {recursive: true});
    writeChanged('.runtime/project.json', JSON.stringify(project, null, 2));
    const escape = value => value.replace(/[.*+?^${}()|[\]\\~]/g, '\\$&');
    // Keep PHP's startup filter stable. Each request exports only the selected
    // files, so changing themes does not require restarting PHP-FPM.
    const allowed = mountRoots.map(root => escape(`/var/www/html/${root}/`)).join('|') || '(?!)';
    writeChanged('.runtime/coverage.ini', `pcov.directory=/var/www/html/app\npcov.exclude="~^(?!(?:${allowed}))~"\n`);
    const mount = (source, target) => ({type: 'bind', source, target, read_only: true});
    const sources = mountRoots.map(root => mount(`./.runtime/${root}`, `/var/www/html/${root}`));
    // Magento publishes static assets as symlinks in developer mode. Nginx must
    // resolve those links to the same copies PHP used for the first response.
    writeChanged('.runtime/compose.sources.json', JSON.stringify({services: {
        app: {volumes: sources},
        phpfpm: {volumes: [...sources,
            mount('./.runtime/project.json', '/application/project.json'),
            mount('./.runtime/coverage.ini', '/usr/local/etc/php/conf.d/zzz-magelens-scope.ini')
        ]}
    }}, null, 2));
}

function writeChanged(file, content) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
        // These files can be bind-mounted: retain their inodes.
        fs.writeFileSync(file, content);
    }
}

function nginxConfig(template, environment = process.env) {
    const defaults = {APPLICATION_PORT: '80', APPLICATION_HTTPS_PORT: '443', CYPRESS_VIEW_PORT: '6080'};
    const ports = Object.entries(defaults).map(([key, fallback]) => [key, environment[key] || fallback]);
    for (const [key, value] of ports) {
        if (!/^[0-9]+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error(`Invalid ${key}`);
    }
    if (new Set(ports.map(([, value]) => Number(value))).size !== ports.length) throw new Error('Application and viewer ports must be different');
    return ports.reduce((config, [key, value]) => config.replaceAll(`__${key}__`, String(Number(value))), template);
}

module.exports = {discover, files, writeRuntime, writeChanged, nginxConfig, specPatterns, withThemeRoots, isCypressJavaScript};
