const apiUrl = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Request failed');
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result.data ?? result;
}

function normalizeUser(user) {
  if (!user) return user;
  return {
    ...user,
    full_name: user.full_name || user.display_name || user.email,
    photo_url: user.photo_url || user.avatar_url || '',
    role: user.role === 'member' ? 'user' : user.role,
  };
}

function sortRecords(records, sort) {
  if (!sort) return records;
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [...records].sort((left, right) => {
    const result = String(left[field] ?? '').localeCompare(String(right[field] ?? ''), undefined, { numeric: true });
    return descending ? -result : result;
  });
}

function matchesQuery(record, query) {
  return Object.entries(query || {}).every(([field, expected]) => {
    const actual = record[field];
    if (Array.isArray(actual)) return actual.includes(expected);
    return actual === expected;
  });
}

function entityClient(entity) {
  const list = async (sort, limit) => {
    const records = await request(`/source/${entity}`);
    const sorted = sortRecords(records, sort);
    return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
  };

  return {
    list,
    async filter(query, sort, limit) {
      const records = (await list(sort)).filter((record) => matchesQuery(record, query));
      return Number.isFinite(limit) ? records.slice(0, limit) : records;
    },
    create(data) {
      return request(`/source/${entity}`, { method: 'POST', body: JSON.stringify(data) });
    },
    update(id, data) {
      return request(`/source/${entity}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    delete(id) {
      return request(`/source/${entity}/${id}`, { method: 'DELETE' });
    },
    subscribe(listener) {
      let previous = new Map();
      let stopped = false;

      const poll = async () => {
        try {
          const records = await list('-updated_date', 100);
          const current = new Map(records.map((record) => [record.id, JSON.stringify(record)]));
          if (previous.size) {
            for (const record of records) {
              if (!previous.has(record.id)) listener({ type: 'create', data: record });
              else if (previous.get(record.id) !== current.get(record.id)) listener({ type: 'update', data: record });
            }
            for (const id of previous.keys()) {
              if (!current.has(id)) listener({ type: 'delete', id });
            }
          }
          previous = current;
        } catch {
          // Polling is best-effort; page-level loads still surface request errors.
        }
      };

      poll();
      const interval = window.setInterval(() => { if (!stopped) poll(); }, 5000);
      return () => {
        stopped = true;
        window.clearInterval(interval);
      };
    },
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const base44 = {
  entities: new Proxy({}, {
    get(_target, entity) {
      return entityClient(String(entity));
    },
  }),
  auth: {
    async me() {
      return normalizeUser(await request('/me'));
    },
    async updateMe(data) {
      return normalizeUser(await request('/me', { method: 'PATCH', body: JSON.stringify(data) }));
    },
    async logout() {
      await fetch(`${apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
      window.location.assign('/');
    },
    redirectToLogin() {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.assign(`${apiUrl}/auth/google?returnTo=${returnTo}`);
    },
  },
  users: {
    inviteUser(email, role) {
      return request('/users/invite', { method: 'POST', body: JSON.stringify({ email, role }) });
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        return { file_url: await fileToDataUrl(file) };
      },
      SendEmail(payload) {
        return request('/integrations/email', { method: 'POST', body: JSON.stringify(payload) });
      },
      InvokeLLM({ prompt }) {
        return request('/integrations/summary', { method: 'POST', body: JSON.stringify({ prompt }) });
      },
    },
  },
  appLogs: {
    logUserInApp() {
      return Promise.resolve();
    },
  },
};