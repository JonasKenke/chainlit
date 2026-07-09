describe('Prompt Gallery', () => {
  it('shows gallery button in message composer', () => {
    cy.get('#prompt-gallery-open').should('exist');
  });

  it('opens a dialog (not a small popover) on gallery button click', () => {
    cy.get('#prompt-gallery-open').click();
    // Radix Dialog renders role="dialog"
    cy.get('[role="dialog"]').should('be.visible');
    // Dialog header contains the gallery title
    cy.get('[role="dialog"]').contains('Prompt Gallery').should('be.visible');
  });

  it('dialog contains a New Prompt button', () => {
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('#prompt-gallery-new').should('be.visible');
  });

  it('dialog contains a search input', () => {
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"] input[placeholder]').should('be.visible');
  });

  it('creates a new prompt via New Prompt button', () => {
    // Open gallery, click New Prompt
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('#prompt-gallery-new').click();

    // PromptSaveDialog should now be open
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('#prompt-title').type('My E2E Prompt');
    cy.get('#prompt-content').type('Write a summary of: {text}');
    cy.contains('button', 'Save').click();

    // Re-open gallery to verify the new prompt appears
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('My E2E Prompt').should('be.visible');
  });

  it('inserts prompt content into composer on click', () => {
    // First create a prompt (build on previous state via ordering)
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('#prompt-gallery-new').click();
    cy.get('#prompt-title').type('Insert Test');
    cy.get('#prompt-content').type('Hello from gallery');
    cy.contains('button', 'Save').click();

    // Open gallery and click the prompt
    cy.get('#prompt-gallery-open').click();
    cy.contains('Insert Test').click();

    // Dialog should close and composer should have the prompt text
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('#chat-input').should('have.value', 'Hello from gallery');
  });

  it('shows bookmark icon on user message hover', () => {
    // Send a message first
    cy.get('#chat-input').type('Bookmark me please{enter}');
    cy.get('.step').should('have.length.gte', 1);

    // Hover the user message row to reveal bookmark button
    cy.get('.step').first().trigger('mouseover');
    cy.get('[aria-label="Save prompt"]').should('exist');
  });

  it('saves a user message as prompt via bookmark icon', () => {
    cy.get('#chat-input').type('Prompt to bookmark{enter}');
    cy.get('.step').should('have.length.gte', 1);

    cy.get('.step').first().trigger('mouseover');
    cy.get('[aria-label="Save prompt"]').click({ force: true });

    // Save dialog opens pre-filled with message content
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('#prompt-title').type('Bookmarked Prompt');
    cy.contains('button', 'Save').click();

    // Verify it appears in gallery
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Bookmarked Prompt').should('be.visible');
  });

  it('can delete a prompt from the gallery', () => {
    // Create a prompt first
    cy.get('#prompt-gallery-open').click();
    cy.get('#prompt-gallery-new').click();
    cy.get('#prompt-title').type('To Delete');
    cy.get('#prompt-content').type('Delete me');
    cy.contains('button', 'Save').click();

    // Open gallery, find the prompt and delete it
    cy.get('#prompt-gallery-open').click();
    cy.contains('To Delete').should('be.visible');
    cy.get('[aria-label="Delete"]').first().click({ force: true });
    cy.contains('To Delete').should('not.exist');
  });

  it('can filter prompts by typing in search', () => {
    // Create two prompts
    cy.get('#prompt-gallery-open').click();
    cy.get('#prompt-gallery-new').click();
    cy.get('#prompt-title').type('Alpha Prompt');
    cy.get('#prompt-content').type('Alpha content');
    cy.contains('button', 'Save').click();

    cy.get('#prompt-gallery-open').click();
    cy.get('#prompt-gallery-new').click();
    cy.get('#prompt-title').type('Beta Prompt');
    cy.get('#prompt-content').type('Beta content');
    cy.contains('button', 'Save').click();

    // Open gallery and search
    cy.get('#prompt-gallery-open').click();
    cy.get('[role="dialog"] input[placeholder]').type('Alpha');
    cy.contains('Alpha Prompt').should('be.visible');
    cy.contains('Beta Prompt').should('not.exist');
  });
});
