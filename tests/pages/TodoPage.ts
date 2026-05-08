import { expect, type Locator, type Page } from '@playwright/test';

export class TodoPage {
  readonly heading: Locator;
  readonly newTaskInput: Locator;
  readonly assigneeSelect: Locator;
  readonly prioritySelect: Locator;
  readonly dueDateInput: Locator;
  readonly addButton: Locator;
  readonly taskItems: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly priorityFilter: Locator;
  readonly summary: Locator;
  readonly pageSummary: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Team Tasks' });
    this.newTaskInput = page.getByPlaceholder('Write a task');
    this.assigneeSelect = page.getByLabel('Assignee');
    this.prioritySelect = page.getByLabel('Priority').first();
    this.dueDateInput = page.getByLabel('Due date');
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.taskItems = page.getByTestId('task-row');
    this.searchInput = page.getByTestId('task-search');
    this.statusFilter = page.getByTestId('status-filter');
    this.priorityFilter = page.getByTestId('priority-filter');
    this.summary = page.getByTestId('task-summary');
    this.pageSummary = page.getByTestId('task-page-summary');
    this.previousPageButton = page.getByTestId('previous-page');
    this.nextPageButton = page.getByTestId('next-page');
  }

  async goto() {
    await this.page.goto('/todos');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async addTask(taskName: string) {
    await this.newTaskInput.fill(taskName);
    await this.addButton.click();
  }

  async addDetailedTask(task: { title: string; assignee: string; priority: string; dueDate: string }) {
    await this.newTaskInput.fill(task.title);
    await this.assigneeSelect.selectOption({ label: task.assignee });
    await this.prioritySelect.selectOption(task.priority);
    await this.dueDateInput.fill(task.dueDate);
    await this.addButton.click();
  }

  taskRow(taskName: string) {
    return this.taskItems.filter({ hasText: taskName });
  }

  latestTaskRow(taskName: string) {
    return this.taskRow(taskName).last();
  }

  taskStatus(taskName: string) {
    return this.taskRow(taskName).locator('td').nth(3);
  }

  async completeTask(taskName: string) {
    await this.latestTaskRow(taskName).getByRole('button', { name: `Mark ${taskName} complete` }).click();
  }

  async searchFor(text: string) {
    await this.searchInput.fill(text);
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  async filterByPriority(priority: string) {
    await this.priorityFilter.selectOption(priority);
  }

  async expectTaskVisible(taskName: string) {
    await expect(this.latestTaskRow(taskName)).toBeVisible();
  }

  async expectTaskHidden(taskName: string) {
    await expect(this.taskRow(taskName)).toHaveCount(0);
  }

  async expectSummary(message: string) {
    await expect(this.summary).toHaveText(message);
  }

  async expectPageSummary(message: string) {
    await expect(this.pageSummary).toHaveText(message);
  }
}
