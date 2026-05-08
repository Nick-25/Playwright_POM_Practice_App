# Playwright POM Practice App

A small practice project for learning Playwright the way many teams use it:
standard Playwright Test, a real local app, and Page Object Model classes.

## What is included

- A tiny Node server in `server.js`
- A static sample app in `app/`
- Playwright config with `webServer`, `baseURL`, and desktop browser projects
- Page objects in `tests/pages/`
- Example specs for tasks, sign-in validation, and profile API loading

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
GET http://127.0.0.1:3000/api/tasks
Authorization: Bearer YOUR_TOKEN_HERE
```

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
