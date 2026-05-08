import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT ?? 3000);
const appRoot = join(process.cwd(), 'app');
const jwtSecret = process.env.JWT_SECRET ?? 'local-development-secret';
const sessionMaxAgeSeconds = 60 * 60 * 4;

const users = [
  {
    id: 'ada',
    email: 'ada@example.com',
    password: 'lovelace-123',
    name: 'Ada Lovelace',
    role: 'Automation Engineer',
    team: 'Quality Platform',
    access: 'user',
  },
  {
    id: 'grace',
    email: 'grace@example.com',
    password: 'hopper-123',
    name: 'Grace Hopper',
    role: 'Test Architect',
    team: 'Developer Experience',
    access: 'user',
  },
  {
    id: 'nick',
    email: 'nick@example.com',
    password: 'nick-123',
    name: 'Nick Boegel',
    role: 'Super User',
    team: 'Analytics',
    access: 'user',
  },
  {
    id: 'admin',
    email: 'admin@example.com',
    password: 'admin-123',
    name: 'Admin User',
    role: 'Portal Administrator',
    team: 'Platform Operations',
    access: 'admin',
  },
];

function nextUserId(name, email) {
  const base = String(name || email)
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  let id = base || `user-${Date.now()}`;
  let suffix = 2;

  while (users.some(user => user.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return id;
}

const tasks = [
  {
    id: 'task-101',
    title: 'Review pull request',
    assigneeId: 'ada',
    priority: 'High',
    status: 'In progress',
    dueDate: '2026-05-11',
  },
  {
    id: 'task-102',
    title: 'Update test plan',
    assigneeId: 'grace',
    priority: 'Medium',
    status: 'Blocked',
    dueDate: '2026-05-14',
  },
  {
    id: 'task-103',
    title: 'Triage flaky checkout test',
    assigneeId: 'nick',
    priority: 'High',
    status: 'Open',
    dueDate: '2026-05-18',
  },
];

let nextTaskNumber = 104;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signJwtPart(value) {
  return createHmac('sha256', jwtSecret).update(value).digest('base64url');
}

function createJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlEncode({
    sub: user.id,
    email: user.email,
    access: user.access,
    iat: now,
    exp: now + sessionMaxAgeSeconds,
  });
  const unsignedToken = `${header}.${payload}`;

  return `${unsignedToken}.${signJwtPart(unsignedToken)}`;
}

function verifyJwt(token) {
  const [header, payload, signature] = String(token ?? '').split('.');

  if (!header || !payload || !signature) return null;

  const expectedSignature = signJwtPart(`${header}.${payload}`);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie ?? '')
      .split(';')
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const [name, ...value] = cookie.split('=');
        return [name, decodeURIComponent(value.join('='))];
      }),
  );
}

function setSessionCookie(response, token) {
  response.setHeader(
    'Set-Cookie',
    `session_token=${encodeURIComponent(token)}; Path=/; Max-Age=${sessionMaxAgeSeconds}; SameSite=Lax; HttpOnly`,
  );
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', 'session_token=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly');
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', chunk => {
      body += chunk;

      if (body.length > 10_000) {
        request.destroy();
        reject(new Error('Request body is too large'));
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Request body must be valid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    team: user.team,
    access: user.access,
  };
}

function publicTask(task) {
  const assignee = users.find(user => user.id === task.assigneeId);

  return {
    id: task.id,
    title: task.title,
    assigneeId: task.assigneeId,
    assignee: assignee?.name ?? 'Unknown user',
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
  };
}

function tokenFromRequest(request) {
  const authorization = request.headers.authorization ?? '';
  const bearerToken = authorization.replace(/^Bearer\s+/i, '');

  return bearerToken || parseCookies(request).session_token;
}

function userFromRequest(request) {
  const claims = verifyJwt(tokenFromRequest(request));

  return users.find(user => user.id === claims?.sub);
}

function requireUser(request, response) {
  const user = userFromRequest(request);

  if (!user) {
    sendJson(response, 401, { message: 'A valid session token is required.' });
    return null;
  }

  return user;
}

function requireAdmin(request, response) {
  const user = requireUser(request, response);

  if (!user) return null;

  if (user.access !== 'admin') {
    sendJson(response, 403, { message: 'Admin access is required.' });
    return null;
  }

  return user;
}

function resolveFilePath(pathname) {
  const routes = {
    '/': 'index.html',
    '/todos': 'todos.html',
    '/sign-in': 'sign-in.html',
    '/profile': 'profile.html',
    '/unauthorized': 'unauthorized.html',
  };

  const routeFile = routes[pathname] ?? pathname.replace(/^\//, '');
  const normalizedPath = normalize(routeFile);

  if (normalizedPath.startsWith('..')) {
    return null;
  }

  return join(appRoot, normalizedPath);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (url.pathname === '/api/users' && request.method === 'GET') {
    sendJson(
      response,
      200,
      users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        team: user.team,
        access: user.access,
      })),
    );
    return;
  }

  if (url.pathname === '/api/users' && request.method === 'POST') {
    const admin = requireAdmin(request, response);

    if (!admin) return;

    try {
      const newUser = await readJson(request);
      const email = String(newUser.email ?? '').trim().toLowerCase();
      const password = String(newUser.password ?? '');
      const name = String(newUser.name ?? '').trim();
      const role = String(newUser.role ?? '').trim();
      const team = String(newUser.team ?? '').trim();
      const access = newUser.access === 'admin' ? 'admin' : 'user';

      if (!email || !password || !name || !role || !team) {
        sendJson(response, 400, { message: 'Email, password, name, role, and team are required.' });
        return;
      }

      if (users.some(user => user.email === email)) {
        sendJson(response, 409, { message: 'A user with this email already exists.' });
        return;
      }

      const createdUser = {
        id: nextUserId(name, email),
        email,
        password,
        name,
        role,
        team,
        access,
      };

      users.push(createdUser);
      sendJson(response, 201, { user: publicUser(createdUser) });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (url.pathname.startsWith('/api/users/') && request.method === 'DELETE') {
    const admin = requireAdmin(request, response);

    if (!admin) return;

    const userId = decodeURIComponent(url.pathname.replace('/api/users/', ''));
    const userIndex = users.findIndex(user => user.id === userId);

    if (userIndex === -1) {
      sendJson(response, 404, { message: 'User not found.' });
      return;
    }

    if (users[userIndex].id === admin.id) {
      sendJson(response, 400, { message: 'You cannot delete your own admin account.' });
      return;
    }

    const [deletedUser] = users.splice(userIndex, 1);
    sendJson(response, 200, { deletedUser: publicUser(deletedUser) });
    return;
  }

  if (url.pathname === '/api/login') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { message: 'Method not allowed' });
      return;
    }

    try {
      const credentials = await readJson(request);
      const email = String(credentials.email ?? '').trim().toLowerCase();
      const password = String(credentials.password ?? '');
      const user = users.find(candidate => candidate.email === email && candidate.password === password);

      if (!user) {
        sendJson(response, 401, { message: 'Email or password is incorrect.' });
        return;
      }

      const token = createJwt(user);
      setSessionCookie(response, token);
      sendJson(response, 200, {
        token,
        expiresIn: sessionMaxAgeSeconds,
        user: publicUser(user),
      });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (url.pathname === '/api/logout') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { message: 'Method not allowed' });
      return;
    }

    clearSessionCookie(response);
    sendJson(response, 200, { message: 'Signed out.' });
    return;
  }

  if (url.pathname === '/api/session') {
    const user = userFromRequest(request);

    if (!user) {
      sendJson(response, 401, { message: 'No active session.' });
      return;
    }

    sendJson(response, 200, {
      token: tokenFromRequest(request),
      expiresIn: sessionMaxAgeSeconds,
      user: publicUser(user),
    });
    return;
  }

  if (url.pathname === '/api/profile') {
    const user = userFromRequest(request);

    if (!user) {
      sendJson(response, 401, { message: 'Please sign in to load your profile.' });
      return;
    }

    sendJson(response, 200, publicUser(user));
    return;
  }

  if (url.pathname === '/api/dashboard') {
    const user = userFromRequest(request);

    if (!user) {
      sendJson(response, 401, { message: 'Please sign in to view your dashboard.' });
      return;
    }

    const assignedTasks = tasks.filter(task => task.assigneeId === user.id);

    sendJson(response, 200, {
      owner: publicUser(user),
      metrics: {
        openTasks: assignedTasks.filter(task => task.status !== 'Done').length,
        blockedTasks: assignedTasks.filter(task => task.status === 'Blocked').length,
        highPriorityTasks: assignedTasks.filter(task => task.priority === 'High').length,
      },
      recentActivity: [
        `${user.name} signed in`,
        'Grace Hopper updated the test plan',
        'Ada Lovelace reviewed a pull request',
      ],
      tasks: assignedTasks.map(publicTask),
    });
    return;
  }

  if (url.pathname === '/api/tasks' && request.method === 'GET') {
    const user = requireUser(request, response);

    if (!user) return;

    sendJson(response, 200, {
      tasks: tasks.filter(task => task.assigneeId === user.id).map(publicTask),
    });
    return;
  }

  if (url.pathname === '/api/tasks' && request.method === 'POST') {
    const user = requireUser(request, response);

    if (!user) return;

    try {
      const task = await readJson(request);
      const title = String(task.title ?? '').trim();
      const assigneeId = String(task.assigneeId ?? '').trim();
      const priority = ['High', 'Medium', 'Low'].includes(task.priority) ? task.priority : 'Medium';
      const dueDate = String(task.dueDate ?? '').trim();

      if (!title || !assigneeId) {
        sendJson(response, 400, { message: 'Title and assigneeId are required.' });
        return;
      }

      if (!users.some(candidate => candidate.id === assigneeId)) {
        sendJson(response, 404, { message: 'Assignee not found.' });
        return;
      }

      const createdTask = {
        id: `task-${nextTaskNumber}`,
        title,
        assigneeId,
        priority,
        status: 'Open',
        dueDate,
      };
      nextTaskNumber += 1;
      tasks.push(createdTask);

      sendJson(response, 201, { task: publicTask(createdTask) });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (url.pathname.match(/^\/api\/tasks\/[^/]+\/complete$/) && request.method === 'PATCH') {
    const user = requireUser(request, response);

    if (!user) return;

    const taskId = decodeURIComponent(url.pathname.split('/')[3]);
    const task = tasks.find(candidate => candidate.id === taskId);

    if (!task) {
      sendJson(response, 404, { message: 'Task not found.' });
      return;
    }

    if (task.assigneeId !== user.id && user.access !== 'admin') {
      sendJson(response, 403, { message: 'You can only complete tasks assigned to you.' });
      return;
    }

    task.status = 'Done';
    sendJson(response, 200, { task: publicTask(task) });
    return;
  }

  if (url.pathname === '/api/user-info') {
    const user = userFromRequest(request);

    if (!user) {
      sendJson(response, 401, { message: 'A valid session token is required.' });
      return;
    }

    sendJson(response, 200, {
      users: user.access === 'admin' ? users.map(publicUser) : [publicUser(user)],
    });
    return;
  }

  const filePath = resolveFilePath(url.pathname);

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await stat(filePath);

    if (!file.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Sample app running at http://127.0.0.1:${port}`);
});
