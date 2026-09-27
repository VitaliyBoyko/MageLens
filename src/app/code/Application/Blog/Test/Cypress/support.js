export const fixtures = () => Cypress.expose('projectFixtures').Application_Blog;
export const headers = () => ({'x-application-coverage': Cypress.expose('coverageRun')});
export const get = (name) => cy.get(`[data-cy="${name}"]`);
export function login(username = 'application', password = 'ApplicationOnly123456!') {
    cy.visit('/admin/');
    cy.get('#username').type(username);
    cy.get('#login').type(password, {log: false});
    cy.get('.action-login').click();
    cy.get('#nav').should('be.visible');
}
export function section(name) {
    cy.get('.admin__menu-overlay').should('exist');
    cy.get('#menu-application-blog-manage > a').click();
    cy.get(`[data-ui-id="menu-application-blog-${name}"] > a`).click();
    get('blog-admin').should('be.visible');
}
export function findRecord(name) {
    get('admin-search').clear().type(name);
    get('admin-search-submit').click();
    get('admin-row').should('have.length', 1).find('[data-cy="admin-edit"]').click();
    get('blog-editor').should('be.visible');
}
export function save() {
    get('admin-save').click();
    cy.get('.message-success').should('contain', 'Saved successfully.');
}
export function remove() {
    get('admin-delete').click();
    cy.get('.modal-popup._show .action-accept').click();
    cy.get('.message-success').should('contain', 'Deleted successfully.');
}
export function search(query, category = '') {
    get('search').clear();
    if (query) get('search').type(query);
    get('category').select(category);
    get('search-submit').click();
    get('status').should('not.contain', 'Loading');
}
