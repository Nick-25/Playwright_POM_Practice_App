# Playwright POM Practice App

A full-stack QA automation practice project built around a real local web app,
Playwright Test, Page Object Model classes, API testing, and GitHub Actions CI.

This repo is meant to feel like a small professional test automation project:
the app has authentication, protected pages, task workflows, SQLite-backed data,
API endpoints, browser tests, API tests, CI execution, HTML artifacts, and a
custom GitHub Actions test summary.

## Project Type

This is a **Playwright end-to-end and API automation portfolio project**.

It demonstrates:

- Page Object Model test design for browser workflows
- API authentication and authorization testing
- A local Node.js application under test
- SQLite-backed test data persistence
- Playwright `webServer` orchestration
- Cross-browser test projects for Chromium and Firefox
- GitHub Actions CI that installs, builds, runs, reports, and archives results
- A custom test-results summary showing passed, failed, flaky, skipped, retry,
  and duration information in the GitHub Actions run summary

## What is included

- A tiny Node server in `server.js`
- A static sample app in `app/`
- Local SQLite persistence in `data/app.db`
- Playwright config with `webServer`, `baseURL`, and desktop browser projects
- Page objects in `tests/pages/`
- Browser specs for dashboard, sign-in, authorization, profile, and task flows
- API specs for JWT sessions, user management, task creation, and pagination
- GitHub Actions workflow in `.github/workflows/playwright.yml`
- Test summary generator in `scripts/write-playwright-summary.mjs`

## Continuous Integration

The GitHub Actions workflow runs on pushes and pull requests to `master`.

CI steps:

1. Checks out the repository
2. Sets up Node.js 20 with npm caching
3. Installs dependencies with `npm ci`
4. Installs Playwright browsers and system dependencies
5. Runs `npm run build --if-present`
6. Runs the Playwright suite with list, JSON, and HTML reporters
7. Publishes a GitHub Actions job summary with grouped test results
8. Uploads the Playwright HTML report and raw test results as artifacts

The Actions summary includes:

- Overall pass/fail status
- Total passed, failed, flaky, and skipped tests
- Total duration
- A focused section for failures, flakes, and interrupted tests
- Collapsible per-browser sections for all Chromium and Firefox tests
- Retry counts and duration for each test

## Commands

```powershell
npm install
npx playwright install
npm run start
npm test
```

The app runs at `http://127.0.0.1:3000`.

Playwright starts the app automatically when you run `npm test`, so you only
need `npm run start` when you want to click around manually.

To generate the same report formats used in CI locally:

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE="test-results/playwright-results.json"
npx playwright test --reporter=list,json,html
node scripts/write-playwright-summary.mjs test-results/playwright-results.json
```

The summary script writes to the GitHub Actions job summary when
`GITHUB_STEP_SUMMARY` is available. Locally, it prints the Markdown summary to
the terminal.

## Local Data

Users and tasks are stored in a local SQLite database at `data/app.db`.
The database is created and seeded automatically when the server starts.

The database file is ignored by Git, so API-created users and tasks persist on
your machine across server restarts but are not pushed to GitHub.

To reset local data, stop the server and delete `data/app.db`. The next server
start will recreate the database with the seeded users and tasks.

## Useful Playwright Scripts

```powershell
npm run test:headed
npm run test:ui
npm run test:debug
npm run report
```

## Postman API Flow

### Seeded Users

| Email | Password | Access |
| --- | --- | --- |
| `nick@example.com` | `nick-123` | user |
| `ada@example.com` | `lovelace-123` | user |
| `grace@example.com` | `hopper-123` | user |
| `admin@example.com` | `admin-123` | admin |

### Authentication

Log in first. The response includes a JWT token and the browser receives a
4-hour `session_token` cookie.

```http
POST http://127.0.0.1:3000/api/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin-123"
}
```

Use the returned token for protected API calls:

```http
Authorization: Bearer YOUR_TOKEN_HERE
```

For Postman convenience, you can mint a token with a local signing key instead
of logging in through the UI. The default local key is `local-postman-key`.
You can override it when starting the server:

```powershell
$env:POSTMAN_SIGNING_KEY="your-local-key"
npm run start
```

Then mint a token:

```http
POST http://127.0.0.1:3000/api/dev-token
x-signing-key: local-postman-key
Content-Type: application/json

{
  "email": "admin@example.com",
  "expiresInHours": 48
}
```

`expiresInHours` is optional. Dev tokens default to 24 hours and are capped at
7 days. For local Postman testing, use `"expiresInHours": "never"` to create a
non-expiring token.

Tokens remain valid after server restarts as long as `JWT_SECRET` stays the
same and the token has not expired. Non-expiring dev tokens remain valid until
you change `JWT_SECRET` or delete the user. The default local JWT secret is
stable for this practice app, but you can set your own:

```powershell
$env:JWT_SECRET="your-local-jwt-secret"
npm run start
```

Log out clears the browser cookie:

```http
POST http://127.0.0.1:3000/api/logout
```

### Get Current Session

Returns the current user when the browser has a valid `session_token` cookie.

```http
GET http://127.0.0.1:3000/api/session
```

### Get User Info

Admin tokens return all users. Regular user tokens return only the signed-in
user.

```http
GET http://127.0.0.1:3000/api/user-info
Authorization: Bearer YOUR_TOKEN_HERE
```

### Add a User

Admin token required.

```http
POST http://127.0.0.1:3000/api/users
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json

{
  "email": "pat@example.com",
  "password": "pat-12345",
  "name": "Pat Analyst",
  "role": "Data Analyst",
  "team": "Reporting",
  "access": "user"
}
```

Required fields: `email`, `password`, `name`, `role`, and `team`.
`access` is optional and defaults to `user`; use `admin` only for admin users.

Common responses:

- `201` user created
- `400` missing required fields or invalid JSON
- `401` missing/invalid token
- `403` token belongs to a non-admin user
- `409` email already exists

### Delete a User

Admin token required. Use the `id` returned from `POST /api/users` or
`GET /api/user-info`.

```http
DELETE http://127.0.0.1:3000/api/users/pat-analyst
Authorization: Bearer ADMIN_TOKEN_HERE
```

Common responses:

- `200` user deleted
- `401` missing/invalid token
- `403` token belongs to a non-admin user
- `404` user id does not exist

The logged-in admin cannot delete their own admin account.

### Get My Tasks

Returns only the tasks assigned to the user represented by the token.

```http
GET http://127.0.0.1:3000/api/tasks?page=1&pageSize=10
Authorization: Bearer YOUR_TOKEN_HERE
```

Optional query parameters:

- `page` defaults to `1`
- `pageSize` defaults to `10` and is capped at `50`
- `q` searches task title, status, and priority
- `status` filters by `Open`, `In progress`, `Blocked`, or `Done`
- `priority` filters by `High`, `Medium`, or `Low`

### Add a Task

Any signed-in user can create a task and assign it to any existing user by
`assigneeId`. The created task will only appear in `GET /api/tasks` for the
assigned user.

```http
POST http://127.0.0.1:3000/api/tasks
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "title": "Validate enrollment extract",
  "assigneeId": "ada",
  "priority": "High",
  "dueDate": "2026-05-22"
}
```

Required fields: `title` and `assigneeId`.

Common responses:

- `201` task created
- `400` missing required fields or invalid JSON
- `401` missing/invalid token
- `404` assignee id does not exist

### Mark a Task Complete

The assigned user can mark their task complete. Admin users can complete any
task if they know its id.

```http
PATCH http://127.0.0.1:3000/api/tasks/task-101/complete
Authorization: Bearer YOUR_TOKEN_HERE
```

Common responses:

- `200` task marked complete
- `401` missing/invalid token
- `403` task is assigned to another user
- `404` task id does not exist
