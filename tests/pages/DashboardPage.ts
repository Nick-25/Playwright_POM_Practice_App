import { expect, type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly publicWelcome: Locator;
  readonly headerLogin: Locator;
  readonly headerLogout: Locator;
  readonly homeLink: Locator;
  readonly tasksLink: Locator;
  readonly profileLink: Locator;
  readonly heroLogin: Locator;
  readonly dashboard: Locator;
  readonly authenticatedBanner: Locator;
  readonly authenticatedUser: Locator;
  readonly loadDashboardButton: Locator;
  readonly status: Locator;
  readonly welcome: Locator;
  readonly openMetric: Locator;
  readonly blockedMetric: Locator;
  readonly highPriorityMetric: Locator;
  readonly activityItems: Locator;

  constructor(private readonly page: Page) {
    this.publicWelcome = page.getByTestId('public-welcome');
    this.headerLogin = page.getByTestId('header-login');
    this.headerLogout = page.getByTestId('header-logout');
    const primaryNav = page.getByRole('navigation', { name: 'Primary' });
    this.homeLink = primaryNav.getByRole('link', { name: 'Home', exact: true });
    this.tasksLink = primaryNav.getByRole('link', { name: 'Tasks', exact: true });
    this.profileLink = primaryNav.getByRole('link', { name: 'Profile', exact: true });
    this.heroLogin = page.getByTestId('hero-login');
    this.dashboard = page.getByTestId('dashboard');
    this.authenticatedBanner = page.getByTestId('authenticated-banner');
    this.authenticatedUser = page.getByTestId('authenticated-user');
    this.loadDashboardButton = page.getByTestId('load-dashboard');
    this.status = page.getByRole('status');
    this.welcome = page.getByTestId('dashboard-welcome');
    this.openMetric = page.getByTestId('metric-open');
    this.blockedMetric = page.getByTestId('metric-blocked');
    this.highPriorityMetric = page.getByTestId('metric-high-priority');
    this.activityItems = page.getByTestId('activity-list').getByRole('listitem');
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectPublicWelcome() {
    await expect(this.publicWelcome).toBeVisible();
    await expect(this.dashboard).toBeHidden();
    await expect(this.authenticatedBanner).toBeHidden();
    await expect(this.headerLogin).toBeVisible();
    await expect(this.homeLink).toBeHidden();
    await expect(this.tasksLink).toBeHidden();
    await expect(this.profileLink).toBeHidden();
    await expect(this.page.getByRole('heading', { name: 'Welcome to Nicks Testing Portal.' })).toBeVisible();
  }

  async expectAuthenticatedShell(name: string) {
    await expect(this.publicWelcome).toBeHidden();
    await expect(this.dashboard).toBeVisible();
    await expect(this.authenticatedBanner).toBeVisible();
    await expect(this.authenticatedUser).toHaveText(`Logged in as ${name}`);
    await expect(this.headerLogin).toBeHidden();
    await expect(this.headerLogout).toBeVisible();
    await expect(this.homeLink).toBeVisible();
    await expect(this.tasksLink).toBeVisible();
    await expect(this.profileLink).toBeVisible();
    await expect(this.welcome).toHaveText(`Welcome back, ${name}.`);
  }

  async loadDashboard() {
    await this.loadDashboardButton.click();
  }

  async logout() {
    await this.headerLogout.click();
  }
}
