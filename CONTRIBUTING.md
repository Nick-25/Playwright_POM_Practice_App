# Contributing

Thanks for taking a look at this project.

This is a public portfolio and practice repo, so changes should go through pull
requests instead of direct pushes to `master`.

## Pull Request Expectations

- Keep changes focused and easy to review.
- Run `npm test` before opening a PR when possible.
- Update the README when behavior, commands, reports, or workflows change.
- Do not commit local runtime artifacts such as `data/*.db`, `test-results/`,
  `playwright-report/`, or `ctrf/`.

## CI Requirements

The Playwright workflow must pass before a PR is merged. It builds the app,
runs the browser/API tests, uploads artifacts, and publishes the CTRF test
report in GitHub Actions.

## Ownership

Repository ownership is documented in `.github/CODEOWNERS`. Once branch
protection is enabled, PRs that touch this repo can require owner review before
merge.
