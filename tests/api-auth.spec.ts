import { expect, test, type APIRequestContext } from '@playwright/test';
import { users } from './fixtures/users.js';

type PublicUser = {
  email: string;
};

async function login(request: APIRequestContext, user: (typeof users)[keyof typeof users]) {
  const response = await request.post('/api/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.describe('JWT API access', () => {
  test('creates a 4 hour JWT session cookie at login', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: {
        email: users.ada.email,
        password: users.ada.password,
      },
    });
    const body = await response.json();

    expect(response.headers()['set-cookie']).toContain('session_token=');
    expect(response.headers()['set-cookie']).toContain('Max-Age=14400');
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.expiresIn).toBe(14400);
  });

  test('returns only the current user when called with a regular user token', async ({ request }) => {
    const auth = await login(request, users.ada);
    const response = await request.get('/api/user-info', {
      headers: {
        authorization: `Bearer ${auth.token}`,
      },
    });
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toMatchObject({
      email: users.ada.email,
      access: 'user',
    });
  });

  test('restores the current user from the session cookie', async ({ request }) => {
    await login(request, users.grace);
    const response = await request.get('/api/session');
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(body.user.email).toBe(users.grace.email);
    expect(body.token.split('.')).toHaveLength(3);
  });

  test('returns all users when called with an admin token', async ({ request }) => {
    const auth = await login(request, users.admin);
    const response = await request.get('/api/user-info', {
      headers: {
        authorization: `Bearer ${auth.token}`,
      },
    });
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(body.users.map((user: PublicUser) => user.email)).toEqual(
      expect.arrayContaining([users.ada.email, users.grace.email, users.nick.email, users.admin.email]),
    );
  });

  test('rejects user info requests without a valid token', async ({ request }) => {
    const response = await request.get('/api/user-info');
    const body = await response.json();

    expect(response.status()).toBe(401);
    expect(body.message).toBe('A valid session token is required.');
  });

  test('creates a longer-lived Postman token with the signing key', async ({ request }) => {
    const response = await request.post('/api/dev-token', {
      headers: {
        'x-signing-key': 'local-postman-key',
      },
      data: {
        email: users.admin.email,
        expiresInHours: 48,
      },
    });
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.expiresIn).toBe(172800);
    expect(body.user.email).toBe(users.admin.email);
  });

  test('creates a non-expiring Postman token with the signing key', async ({ request }) => {
    const response = await request.post('/api/dev-token', {
      headers: {
        'x-signing-key': 'local-postman-key',
      },
      data: {
        email: users.nick.email,
        expiresInHours: 'never',
      },
    });
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.expiresIn).toBeNull();
    expect(body.user.email).toBe(users.nick.email);
  });

  test('rejects dev token requests without the signing key', async ({ request }) => {
    const response = await request.post('/api/dev-token', {
      data: {
        email: users.admin.email,
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(401);
    expect(body.message).toBe('A valid signing key is required.');
  });
});

test.describe('admin user management API', () => {
  test('allows an admin to add and delete a user', async ({ request }) => {
    const adminAuth = await login(request, users.admin);
    const createResponse = await request.post('/api/users', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
      data: {
        email: 'pat@example.com',
        password: 'pat-12345',
        name: 'Pat Analyst',
        role: 'Data Analyst',
        team: 'Reporting',
        access: 'user',
      },
    });
    const createBody = await createResponse.json();

    expect(createResponse.status()).toBe(201);
    expect(createBody.user).toMatchObject({
      email: 'pat@example.com',
      name: 'Pat Analyst',
      access: 'user',
    });

    const userInfoResponse = await request.get('/api/user-info', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const userInfoBody = await userInfoResponse.json();

    expect(userInfoBody.users.map((user: PublicUser) => user.email)).toContain('pat@example.com');

    const deleteResponse = await request.delete(`/api/users/${createBody.user.id}`, {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.ok()).toBeTruthy();
    expect(deleteBody.deletedUser.email).toBe('pat@example.com');
  });

  test('blocks regular users from adding users', async ({ request }) => {
    const userAuth = await login(request, users.ada);
    const response = await request.post('/api/users', {
      headers: {
        authorization: `Bearer ${userAuth.token}`,
      },
      data: {
        email: 'blocked@example.com',
        password: 'blocked-123',
        name: 'Blocked User',
        role: 'Analyst',
        team: 'Reporting',
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(403);
    expect(body.message).toBe('Admin access is required.');
  });

  test('validates duplicate users', async ({ request }) => {
    const adminAuth = await login(request, users.admin);
    const response = await request.post('/api/users', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
      data: {
        email: users.ada.email,
        password: 'duplicate-123',
        name: 'Duplicate Ada',
        role: 'Analyst',
        team: 'Reporting',
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(409);
    expect(body.message).toBe('A user with this email already exists.');
  });

  test('returns not found when deleting an unknown user', async ({ request }) => {
    const adminAuth = await login(request, users.admin);
    const response = await request.delete('/api/users/not-a-real-user', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(404);
    expect(body.message).toBe('User not found.');
  });
});

test.describe('task API', () => {
  test('adds tasks to any user but only returns the logged-in users tasks', async ({ request }) => {
    const adminAuth = await login(request, users.admin);
    const createUserResponse = await request.post('/api/users', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
      data: {
        email: `task-owner-${Date.now()}@example.com`,
        password: 'task-owner-123',
        name: 'Task Owner',
        role: 'Analyst',
        team: 'Reporting',
      },
    });
    const createUserBody = await createUserResponse.json();

    expect(createUserResponse.status()).toBe(201);

    const createTaskResponse = await request.post('/api/tasks', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
      data: {
        title: 'Validate enrollment extract',
        assigneeId: createUserBody.user.id,
        priority: 'High',
        dueDate: '2026-05-22',
      },
    });
    const createTaskBody = await createTaskResponse.json();

    expect(createTaskResponse.status()).toBe(201);
    expect(createTaskBody.task).toMatchObject({
      title: 'Validate enrollment extract',
      assignee: 'Task Owner',
      status: 'Open',
    });

    const adminTasksResponse = await request.get('/api/tasks', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const adminTasksBody = await adminTasksResponse.json();

    expect(adminTasksBody.tasks.map((task: { id: string }) => task.id)).not.toContain(createTaskBody.task.id);

    const ownerAuth = await login(request, {
      ...createUserBody.user,
      password: 'task-owner-123',
    });
    const ownerTasksResponse = await request.get('/api/tasks', {
      headers: {
        authorization: `Bearer ${ownerAuth.token}`,
      },
    });
    const ownerTasksBody = await ownerTasksResponse.json();

    expect(ownerTasksBody.tasks.map((task: { id: string }) => task.id)).toContain(createTaskBody.task.id);
  });

  test('marks the logged-in users task complete through the API', async ({ request }) => {
    const adminAuth = await login(request, users.admin);
    const createTaskResponse = await request.post('/api/tasks', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
      data: {
        title: 'Publish weekly quality report',
        assigneeId: users.admin.id,
        priority: 'Medium',
        dueDate: '2026-05-25',
      },
    });
    const createTaskBody = await createTaskResponse.json();
    const completeResponse = await request.patch(`/api/tasks/${createTaskBody.task.id}/complete`, {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const completeBody = await completeResponse.json();

    expect(completeResponse.ok()).toBeTruthy();
    expect(completeBody.task.status).toBe('Done');
  });

  test('paginates task API results', async ({ request }) => {
    const adminAuth = await login(request, users.admin);

    for (let index = 0; index < 12; index += 1) {
      await request.post('/api/tasks', {
        headers: {
          authorization: `Bearer ${adminAuth.token}`,
        },
        data: {
          title: `API paginated task ${Date.now()} ${index}`,
          assigneeId: users.admin.id,
          priority: 'Low',
          dueDate: '2026-05-30',
        },
      });
    }

    const firstPageResponse = await request.get('/api/tasks?page=1&pageSize=10', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const firstPageBody = await firstPageResponse.json();
    const secondPageResponse = await request.get('/api/tasks?page=2&pageSize=10', {
      headers: {
        authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const secondPageBody = await secondPageResponse.json();

    expect(firstPageResponse.ok()).toBeTruthy();
    expect(firstPageBody.tasks).toHaveLength(10);
    expect(firstPageBody.total).toBeGreaterThanOrEqual(12);
    expect(firstPageBody.totalPages).toBeGreaterThanOrEqual(2);
    expect(secondPageResponse.ok()).toBeTruthy();
    expect(secondPageBody.page).toBe(2);
    expect(secondPageBody.tasks.length).toBeGreaterThan(0);
  });
});
