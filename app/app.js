const todoForm = document.querySelector('[data-testid="todo-form"]');
const signInForm = document.querySelector('[data-testid="sign-in-form"]');
const loadProfileButton = document.querySelector('[data-testid="load-profile"]');
const loadDashboardButton = document.querySelector('[data-testid="load-dashboard"]');
const logoutButtons = document.querySelectorAll('[data-logout]');
const profileForm = document.querySelector('[data-testid="profile-form"]');
const publicWelcome = document.querySelector('[data-testid="public-welcome"]');
const dashboard = document.querySelector('[data-testid="dashboard"]');
const authenticatedUser = document.querySelector('[data-testid="authenticated-user"]');
const headerLogin = document.querySelector('[data-testid="header-login"]');
const headerLogout = document.querySelector('[data-testid="header-logout"]');
const authenticatedLinks = document.querySelectorAll('.auth-only');
const authStorageKey = 'pom-practice-auth';
const profileSettingsKey = 'pom-practice-profile-settings';

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(authStorageKey));
  } catch {
    localStorage.removeItem(authStorageKey);
    return null;
  }
}

function setAuth(auth) {
  localStorage.setItem(authStorageKey, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(authStorageKey);
}

function getProfileSettings() {
  try {
    return JSON.parse(localStorage.getItem(profileSettingsKey)) ?? {};
  } catch {
    localStorage.removeItem(profileSettingsKey);
    return {};
  }
}

function setProfileSettings(settings) {
  localStorage.setItem(profileSettingsKey, JSON.stringify(settings));
}

function clearFieldError(input, error) {
  input.removeAttribute('aria-invalid');
  error.textContent = '';
}

function setFieldError(input, error, message) {
  input.setAttribute('aria-invalid', 'true');
  error.textContent = message;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message ?? 'Something went wrong.');
  }

  return body;
}

function authHeader() {
  const auth = getAuth();
  return auth?.token ? { authorization: `Bearer ${auth.token}` } : {};
}

async function hydrateAuthFromCookie() {
  const hasJustLoggedIn = sessionStorage.getItem('pom-practice-just-logged-in') === 'true';

  if (window.location.pathname === '/' && !hasJustLoggedIn) {
    clearAuth();
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    return;
  }

  sessionStorage.removeItem('pom-practice-just-logged-in');

  if (getAuth()?.token) return;

  try {
    const auth = await fetchJson('/api/session');
    setAuth(auth);
  } catch {
    clearAuth();
  }
}

function redirectUnauthorizedUsers() {
  const protectedPaths = ['/profile', '/todos'];

  if (protectedPaths.includes(window.location.pathname) && !getAuth()?.token) {
    window.location.replace('/unauthorized');
  }
}

function updateAuthNavigation() {
  const isSignedIn = Boolean(getAuth()?.token);

  headerLogin?.classList.toggle('is-hidden', isSignedIn);
  headerLogout?.classList.toggle('is-hidden', !isSignedIn);
  authenticatedLinks.forEach(link => {
    link.classList.toggle('is-hidden', !isSignedIn);
  });
}

function hydrateHomePage() {
  if (!publicWelcome || !dashboard) return;

  const auth = getAuth();
  const isSignedIn = Boolean(auth?.token);

  publicWelcome.classList.toggle('is-hidden', isSignedIn);
  dashboard.classList.toggle('is-hidden', !isSignedIn);

  if (isSignedIn) {
    document.querySelector('[data-testid="dashboard-welcome"]').textContent = `Welcome back, ${auth.user.name}.`;
    authenticatedUser.textContent = `Logged in as ${auth.user.name}`;
  }
}

async function initializeAuthState() {
  await hydrateAuthFromCookie();
  redirectUnauthorizedUsers();
  updateAuthNavigation();
  hydrateHomePage();
}

initializeAuthState();

logoutButtons.forEach(logoutButton => {
  logoutButton.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    clearAuth();
    updateAuthNavigation();
    hydrateHomePage();
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  });
});

if (todoForm) {
  const taskInput = todoForm.querySelector('[name="task"]');
  const assigneeInput = todoForm.querySelector('[name="assignee"]');
  const priorityInput = todoForm.querySelector('[name="priority"]');
  const dueDateInput = todoForm.querySelector('[name="dueDate"]');
  const taskList = document.querySelector('[data-testid="task-list"]');
  const taskSearch = document.querySelector('[data-testid="task-search"]');
  const statusFilter = document.querySelector('[data-testid="status-filter"]');
  const priorityFilter = document.querySelector('[data-testid="priority-filter"]');
  const taskSummary = document.querySelector('[data-testid="task-summary"]');
  const status = document.querySelector('[role="status"]');
  let tasks = [];

  function filteredTasks() {
    const search = taskSearch.value.trim().toLowerCase();

    return tasks.filter(task => {
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search) ||
        task.assignee.toLowerCase().includes(search);
      const matchesStatus = statusFilter.value === 'All' || task.status === statusFilter.value;
      const matchesPriority = priorityFilter.value === 'All' || task.priority === priorityFilter.value;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }

  function renderTasks() {
    const visibleTasks = filteredTasks();

    taskList.replaceChildren(
      ...visibleTasks.map(task => {
        const row = document.createElement('tr');
        row.dataset.testid = 'task-row';
        row.dataset.taskId = task.id;

        const titleCell = document.createElement('td');
        titleCell.textContent = task.title;

        const assigneeCell = document.createElement('td');
        assigneeCell.textContent = task.assignee;

        const priorityCell = document.createElement('td');
        priorityCell.textContent = task.priority;

        const statusCell = document.createElement('td');
        statusCell.textContent = task.status;

        const dueCell = document.createElement('td');
        dueCell.textContent = task.dueDate || 'Not set';

        const actionCell = document.createElement('td');
        const completeButton = document.createElement('button');
        completeButton.type = 'button';
        completeButton.textContent = task.status === 'Done' ? 'Complete' : 'Mark complete';
        completeButton.disabled = task.status === 'Done';
        completeButton.setAttribute('aria-label', `Mark ${task.title} complete`);
        completeButton.addEventListener('click', async () => {
          try {
            const body = await fetchJson(`/api/tasks/${task.id}/complete`, {
              method: 'PATCH',
              headers: authHeader(),
            });
            tasks = tasks.map(candidate => (candidate.id === task.id ? body.task : candidate));
            status.textContent = `${task.title} completed.`;
            renderTasks();
          } catch (error) {
            status.textContent = error.message;
          }
        });
        actionCell.append(completeButton);

        row.append(titleCell, assigneeCell, priorityCell, statusCell, dueCell, actionCell);
        return row;
      }),
    );

    const label = visibleTasks.length === 1 ? 'task' : 'tasks';
    taskSummary.textContent = `${visibleTasks.length} ${label} shown`;
  }

  async function loadAssignees() {
    const users = await fetchJson('/api/users');

    assigneeInput.replaceChildren(
      ...users.map(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        return option;
      }),
    );

    const currentUserId = getAuth()?.user?.id;
    if (currentUserId) {
      assigneeInput.value = currentUserId;
    }
  }

  async function loadTasks() {
    try {
      const body = await fetchJson('/api/tasks', {
        headers: authHeader(),
      });
      tasks = body.tasks;
      renderTasks();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  todoForm.addEventListener('submit', async event => {
    event.preventDefault();

    const title = taskInput.value.trim();
    if (!title) return;

    try {
      const body = await fetchJson('/api/tasks', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          title,
          assigneeId: assigneeInput.value,
          priority: priorityInput.value,
          dueDate: dueDateInput.value,
        }),
      });

      const currentUserId = getAuth()?.user?.id;
      if (body.task.assigneeId === currentUserId) {
        tasks = [...tasks, body.task];
      }
      todoForm.reset();
      assigneeInput.value = currentUserId;
      status.textContent = 'Task created.';
      renderTasks();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  [taskSearch, statusFilter, priorityFilter].forEach(control => {
    control.addEventListener('input', renderTasks);
    control.addEventListener('change', renderTasks);
  });

  initializeAuthState().then(async () => {
    await loadAssignees();
    await loadTasks();
  });
}

if (signInForm) {
  const status = document.querySelector('[role="status"]');
  const emailInput = signInForm.querySelector('[name="email"]');
  const passwordInput = signInForm.querySelector('[name="password"]');
  const emailError = document.querySelector('[data-testid="email-error"]');
  const passwordError = document.querySelector('[data-testid="password-error"]');
  const sampleUsers = document.querySelector('[data-testid="sample-users"]');

  fetchJson('/api/users')
    .then(users => {
      sampleUsers.replaceChildren(
        ...users.map(user => {
          const item = document.createElement('li');
          item.textContent = `${user.name} (${user.email})`;
          return item;
        }),
      );
    })
    .catch(() => {
      sampleUsers.textContent = 'Sample users are temporarily unavailable.';
    });

  signInForm.addEventListener('submit', async event => {
    event.preventDefault();

    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
    status.textContent = '';

    if (!emailInput.validity.valid) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
    }

    if (!passwordInput.validity.valid) {
      setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
    }

    if (!signInForm.checkValidity()) {
      status.textContent = 'Please fix the highlighted fields.';
      return;
    }

    const button = signInForm.querySelector('button');
    button.disabled = true;
    status.textContent = 'Signing in...';

    try {
      const auth = await fetchJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          email: emailInput.value,
          password: passwordInput.value,
        }),
      });

      setAuth(auth);
      sessionStorage.setItem('pom-practice-just-logged-in', 'true');
      window.location.href = '/';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

if (loadDashboardButton) {
  const status = document.querySelector('[role="status"]');
  const welcome = document.querySelector('[data-testid="dashboard-welcome"]');
  const openMetric = document.querySelector('[data-testid="metric-open"]');
  const blockedMetric = document.querySelector('[data-testid="metric-blocked"]');
  const highPriorityMetric = document.querySelector('[data-testid="metric-high-priority"]');
  const activityList = document.querySelector('[data-testid="activity-list"]');

  loadDashboardButton.addEventListener('click', async () => {
    loadDashboardButton.disabled = true;
    status.textContent = 'Loading dashboard...';

    try {
      const dashboard = await fetchJson('/api/dashboard', {
        headers: authHeader(),
      });

      welcome.textContent = `Welcome back, ${dashboard.owner.name}.`;
      openMetric.textContent = String(dashboard.metrics.openTasks);
      blockedMetric.textContent = String(dashboard.metrics.blockedTasks);
      highPriorityMetric.textContent = String(dashboard.metrics.highPriorityTasks);
      activityList.replaceChildren(
        ...dashboard.recentActivity.map(activity => {
          const item = document.createElement('li');
          item.textContent = activity;
          return item;
        }),
      );
      status.textContent = 'Dashboard loaded.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      loadDashboardButton.disabled = false;
    }
  });
}

if (loadProfileButton) {
  const status = document.querySelector('[role="status"]');
  const session = document.querySelector('[data-testid="profile-session"]');
  const auth = getAuth();
  const settings = getProfileSettings();

  if (auth?.user?.name) {
    session.textContent = `Signed in as ${auth.user.name}.`;
  }

  if (profileForm) {
    profileForm.elements.displayName.value = settings.displayName ?? auth?.user?.name ?? '';
    profileForm.elements.preferredTeam.value = settings.preferredTeam ?? auth?.user?.team ?? 'Quality Platform';
    profileForm.elements.emailUpdates.value = settings.emailUpdates ?? 'Daily digest';
  }

  loadProfileButton.addEventListener('click', async () => {
    const currentAuth = getAuth();

    if (!currentAuth?.token) {
      status.textContent = 'Please sign in to load your profile.';
      return;
    }

    loadProfileButton.disabled = true;
    status.textContent = 'Loading profile...';

    try {
      const profile = await fetchJson('/api/profile', {
        headers: authHeader(),
      });

      document.querySelector('[data-testid="profile-name"]').textContent = profile.name;
      document.querySelector('[data-testid="profile-email"]').textContent = profile.email;
      document.querySelector('[data-testid="profile-role"]').textContent = profile.role;
      document.querySelector('[data-testid="profile-team"]').textContent = profile.team;
      status.textContent = 'Profile loaded.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      loadProfileButton.disabled = false;
    }
  });
}

if (profileForm) {
  const status = document.querySelector('[role="status"]');

  profileForm.addEventListener('submit', event => {
    event.preventDefault();

    const settings = {
      displayName: profileForm.elements.displayName.value.trim(),
      preferredTeam: profileForm.elements.preferredTeam.value,
      emailUpdates: profileForm.elements.emailUpdates.value,
    };

    setProfileSettings(settings);
    status.textContent = 'Profile settings saved.';
  });
}
