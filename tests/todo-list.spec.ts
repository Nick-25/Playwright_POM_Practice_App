import { expect, test } from '@playwright/test';
import { signInWithStoredSession } from './helpers/auth.js';
import { TodoPage } from './pages/TodoPage.js';

test.describe('todo list', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithStoredSession(page);
  });

  test('shows existing tasks', async ({ page }) => {
    const todoPage = new TodoPage(page);

    await todoPage.goto();
    await todoPage.expectLoaded();

    await expect(todoPage.taskItems).not.toHaveCount(0);
    await todoPage.expectTaskVisible('Review pull request');
  });

  test('adds a new task', async ({ page }) => {
    const todoPage = new TodoPage(page);

    await todoPage.goto();
    const initialCount = await todoPage.taskItems.count();
    await todoPage.addTask('  Ship Playwright setup  ');

    await expect(todoPage.taskItems).toHaveCount(initialCount + 1);
    await todoPage.expectTaskVisible('Ship Playwright setup');
    await expect(todoPage.newTaskInput).toHaveValue('');
  });

  test('ignores blank tasks', async ({ page }) => {
    const todoPage = new TodoPage(page);

    await todoPage.goto();
    const initialCount = await todoPage.taskItems.count();
    await todoPage.addTask('   ');

    await expect(todoPage.taskItems).toHaveCount(initialCount);
  });

  test('marks a task complete', async ({ page }) => {
    const todoPage = new TodoPage(page);

    await todoPage.goto();
    await todoPage.addTask('Task to complete');
    await todoPage.completeTask('Task to complete');

    await expect(todoPage.taskStatus('Task to complete')).toHaveText('Done');
  });

  test('filters the logged-in user tasks by search text and priority', async ({ page }) => {
    const todoPage = new TodoPage(page);

    await todoPage.goto();
    await todoPage.searchFor('review');
    await todoPage.filterByPriority('High');

    await todoPage.expectSummary('1 task shown');
    await todoPage.expectTaskVisible('Review pull request');
    await todoPage.expectTaskHidden('Update test plan');
  });
});
