describe('Storefront warm-up', () => {
    it('loads the homepage and its dynamic assets', () => {
        cy.visit('/');
        cy.warmupReady();
    });
});
