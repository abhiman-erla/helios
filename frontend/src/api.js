// Relative URLs on purpose: the browser calls the same host that served the
// page, and the proxy in front (Vite dev server, nginx, or the AWS ALB)
// routes /api to the backend. No backend URL is baked into the build, so one
// image works in every environment.
const BASE = '/api/tasks';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.errors?.join(', ') ?? body.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export const listTasks = () => request(BASE);

export const createTask = (task) =>
  request(BASE, { method: 'POST', body: JSON.stringify(task) });

export const updateTask = (id, changes) =>
  request(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });

export const deleteTask = (id) => request(`${BASE}/${id}`, { method: 'DELETE' });
