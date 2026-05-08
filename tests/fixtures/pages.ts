import { test as base } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { SignInPage } from '../pages/SignInPage.js';
import { TodoPage } from '../pages/TodoPage.js';

type PageFixtures = {
  dashboardPage: DashboardPage;
  profilePage: ProfilePage;
  signInPage: SignInPage;
  todoPage: TodoPage;
};

export const test = base.extend<PageFixtures>({
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
  todoPage: async ({ page }, use) => {
    await use(new TodoPage(page));
  },
});

export { expect } from '@playwright/test';
