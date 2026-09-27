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

function files(root) {
    return fs.readdirSync(root, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
        const file = path.join(root, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Symlinked source is unsupported: ${file}`);
        return entry.isDirectory() ? files(file) : [file];
    });
}

function writeRuntime(project) {
    fs.mkdirSync('.runtime', {recursive: true});
    fs.writeFileSync('.runtime/project.json', JSON.stringify(project, null, 2));
    const escape = value => value.replace(/[.*+?^${}()|[\]\\~]/g, '\\$&');
    const allowed = project.roots.map(root => escape(`/var/www/html/${root}/`)).join('|') || '(?!)';
    fs.writeFileSync('.runtime/coverage.ini', `pcov.directory=/var/www/html/app\npcov.exclude="~^(?!(?:${allowed}))~"\n`);
    const mount = (source, target) => ({type: 'bind', source, target, read_only: true});
    fs.writeFileSync('.runtime/compose.sources.json', JSON.stringify({services: {phpfpm: {volumes: [
        ...project.roots.map(root => mount(`./.runtime/${root}`, `/var/www/html/${root}`)),
        mount('./.runtime/project.json', '/application/project.json'),
        mount('./.runtime/coverage.ini', '/usr/local/etc/php/conf.d/zzz-magelens-scope.ini')
    ]}}}, null, 2));
}

module.exports = {discover, files, writeRuntime, specPatterns};
