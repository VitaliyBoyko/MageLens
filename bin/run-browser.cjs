const fs = require('node:fs');
const cypress = require('cypress');
const {specPatterns} = require('./project.cjs');
const run = JSON.parse(fs.readFileSync('coverage/run.json'));
const expectedSpecs = fs.globSync(specPatterns()).sort();
if (!expectedSpecs.length) throw new Error('Add your project tests to cypress/e2e/*.cy.js before running coverage.');
const projectFixtures = JSON.parse(fs.readFileSync('coverage/project-fixtures.json'));
cypress.run({browser: 'electron', headed: true, expose: {coverageRun: run.id, projectFixtures}}).then(results => {
    fs.writeFileSync('coverage/cypress-results.json', JSON.stringify({
        run: run.id, totalTests: results.totalTests, totalPassed: results.totalPassed,
        totalFailed: results.totalFailed, totalPending: results.totalPending,
        totalSkipped: results.totalSkipped, failures: results.failures,
        status: results.status, message: results.message,
        specs: results.runs?.map(result => ({path: result.spec.relative, tests: result.tests.length}))
    }, null, 2));
    const actualSpecs = (results.runs || []).map(result => result.spec.relative).sort();
    if (JSON.stringify(actualSpecs) !== JSON.stringify(expectedSpecs) || results.runs?.some(result => !result.tests.length) || results.failures || !(results.totalTests > 0) || results.totalPassed !== results.totalTests || results.totalFailed !== 0 || results.totalPending !== 0 || results.totalSkipped !== 0) {
        throw new Error('The full Cypress suite did not pass. Inspect coverage/cypress-results.json and cypress/screenshots.');
    }
}).catch(error => { console.error(error); process.exitCode = 1; });
