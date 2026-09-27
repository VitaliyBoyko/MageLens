const {defineConfig} = require('cypress');
const {specPatterns} = require('./bin/project.cjs');
module.exports = defineConfig({
    video: false,
    viewportWidth: 1100,
    viewportHeight: 900,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    expose: {coverageRun: process.env.COVERAGE_RUN, codeCoverage: {expectFrontendCoverageOnly: true}},
    e2e: {
        baseUrl: process.env.CYPRESS_BASE_URL || 'https://magelens.test',
        specPattern: specPatterns(),
        supportFile: 'cypress/support/e2e.js',
        setupNodeEvents(on, config) {
            require('@cypress/code-coverage/task')(on, config);
            return config;
        }
    }
});
