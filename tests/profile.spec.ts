import { test } from './fixtures/pages.js';
import { users } from './fixtures/users.js';
import { signInWithStoredSession } from './helpers/auth.js';

test.describe('profile', () => {
  test('is available with a stored signed-in session', async ({ page, profilePage }) => {
    await signInWithStoredSession(page, 'nick');

    await profilePage.goto();

    await profilePage.expectSession(`Signed in as ${users.nick.name}.`);
  });

  test('loads the signed-in user profile from the app API', async ({ profilePage, signInPage }) => {
    await signInPage.goto();
    await signInPage.signIn(users.ada.email, users.ada.password);

    await profilePage.goto();
    await profilePage.expectSession(`Signed in as ${users.ada.name}.`);
    await profilePage.loadProfile();

    await profilePage.expectStatus('Profile loaded.');
    await profilePage.expectProfile({
      name: users.ada.name,
      email: users.ada.email,
      role: users.ada.role,
      team: users.ada.team,
    });
  });

  test('loads a different profile for a different signed-in user', async ({ profilePage, signInPage }) => {
    await signInPage.goto();
    await signInPage.signIn(users.grace.email, users.grace.password);

    await profilePage.goto();
    await profilePage.loadProfile();

    await profilePage.expectProfile({
      name: users.grace.name,
      email: users.grace.email,
      role: users.grace.role,
      team: users.grace.team,
    });
  });
});
