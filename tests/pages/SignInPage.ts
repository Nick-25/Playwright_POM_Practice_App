import { expect, type Locator, type Page } from '@playwright/test';

export class SignInPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly status: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly sampleUsers: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.status = page.getByRole('status');
    this.emailError = page.getByTestId('email-error');
    this.passwordError = page.getByTestId('password-error');
    this.sampleUsers = page.getByTestId('sample-users').getByRole('listitem');
  }

  async goto() {
    await this.page.goto('/sign-in');
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectStatus(message: string) {
    await expect(this.status).toHaveText(message);
  }

  async expectFieldErrors(errors: { email?: string; password?: string }) {
    if (errors.email !== undefined) {
      await expect(this.emailError).toHaveText(errors.email);
    }

    if (errors.password !== undefined) {
      await expect(this.passwordError).toHaveText(errors.password);
    }
  }
}
