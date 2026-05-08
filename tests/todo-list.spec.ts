import { signInWithStoredSession } from './helpers/auth.js';
import { expect, test } from './fixtures/pages.js';

test.describe('todo list', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithStoredSession(page);
  });

  test('shows existing tasks', async ({ todoPage }) => {
    await todoPage.goto();
    await todoPage.expectLoaded();

    await expect(todoPage.taskItems).not.toHaveCount(0);
    await todoPage.expectTaskVisible('Review pull request');
  });

  test('adds a new task', async ({ todoPage }) => {
    await todoPage.goto();
    const initialCount = await todoPage.taskItems.count();
    const taskName = `Ship Playwright setup ${Date.now()}`;
    await todoPage.addTask(`  ${taskName}  `);

    await expect(todoPage.taskItems).toHaveCount(initialCount + 1);
    await todoPage.expectTaskVisible(taskName);
    await expect(todoPage.newTaskInput).toHaveValue('');
  });

  test('ignores blank tasks', async ({ todoPage }) => {
    await todoPage.goto();
    const initialCount = await todoPage.taskItems.count();
    await todoPage.addTask('   ');

    await expect(todoPage.taskItems).toHaveCount(initialCount);
  });

  test('marks a task complete', async ({ todoPage }) => {
    await todoPage.goto();
    const taskName = `Task to complete ${Date.now()}`;
    await todoPage.addTask(taskName);
    await todoPage.completeTask(taskName);

    await expect(todoPage.latestTaskRow(taskName).locator('td').nth(3)).toHaveText('Done');
  });

  test('filters the logged-in user tasks by search text and priority', async ({ todoPage }) => {
    await todoPage.goto();
    await todoPage.searchFor('review');
    await todoPage.filterByPriority('High');

    await todoPage.expectSummary('1 task shown');
    await todoPage.expectTaskVisible('Review pull request');
    await todoPage.expectTaskHidden('Update test plan');
  });
});
