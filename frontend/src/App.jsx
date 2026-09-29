import { useEffect, useState } from 'react';
import { createTask, deleteTask, listTasks, updateTask } from './api.js';

const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((err) => setError(`Couldn't load tasks: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const task = await createTask({ title, description });
      setTasks((current) => [task, ...current]);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(`Couldn't add task: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    setError('');
    try {
      const updated = await updateTask(id, { status });
      setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(`Couldn't update task: ${err.message}`);
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteTask(id);
      setTasks((current) => current.filter((t) => t.id !== id));
    } catch (err) {
      setError(`Couldn't delete task: ${err.message}`);
    }
  }

  const counts = Object.fromEntries(
    Object.keys(STATUS_LABELS).map((s) => [s, tasks.filter((t) => t.status === s).length]),
  );

  return (
    <main className="app">
      <header className="app-header">
        <h1>TaskOps</h1>
        <p className="summary">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <span key={key} className={`chip chip-${key}`}>
              {label}: {counts[key]}
            </span>
          ))}
        </p>
      </header>

      <form className="new-task" onSubmit={handleCreate}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Write the backend Dockerfile"
          maxLength={200}
          required
        />
        <label htmlFor="description">Description (optional)</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
        />
        <button type="submit" disabled={saving || !title.trim()}>
          {saving ? 'Adding…' : 'Add task'}
        </button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="muted">No tasks yet. Add your first one above.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`task task-${task.status}`}>
              <div className="task-text">
                <strong>{task.title}</strong>
                {task.description && <p>{task.description}</p>}
              </div>
              <div className="task-actions">
                <select
                  aria-label={`Status for ${task.title}`}
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(task.id)}
                  aria-label={`Delete ${task.title}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
