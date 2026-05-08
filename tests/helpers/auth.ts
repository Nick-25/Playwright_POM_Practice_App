import { type Page } from '@playwright/test';
import { users } from '../fixtures/users.js';

type TestUser = keyof typeof users;

export async function signInWithStoredSession(page: Page, userKey: TestUser = 'ada') {
  const user = users[userKey];
  const response = await page.request.post('/api/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });
  const auth = await response.json();

  await page.addInitScript(
    ({ storedAuth }) => {
      localStorage.setItem(
        'pom-practice-auth',
        JSON.stringify(storedAuth),
      );
    },
    { storedAuth: auth },
  );

  return auth;
}
