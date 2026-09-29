import { Router } from 'express';
import { parseId, validateTask } from '../validate.js';

const COLUMNS = 'id, title, description, status, created_at, updated_at';

export function tasksRouter(pool) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM tasks ORDER BY created_at DESC, id DESC`,
    );
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const { value, errors } = validateTask(req.body);
    if (errors.length) return res.status(400).json({ errors });

    // Parameterised queries ($1, $2...) prevent SQL injection.
    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, status)
       VALUES ($1, $2, COALESCE($3, 'todo'))
       RETURNING ${COLUMNS}`,
      [value.title, value.description ?? '', value.status ?? null],
    );
    res.status(201).json(rows[0]);
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'task not found' });

    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'task not found' });
    res.json(rows[0]);
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'task not found' });

    const { value, errors } = validateTask(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });

    // Only fields that were sent get updated; COALESCE keeps the rest.
    const { rows } = await pool.query(
      `UPDATE tasks
         SET title       = COALESCE($2, title),
             description = COALESCE($3, description),
             status      = COALESCE($4, status),
             updated_at  = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, value.title ?? null, value.description ?? null, value.status ?? null],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'task not found' });
    res.json(rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'task not found' });

    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'task not found' });
    res.status(204).end();
  });

  return router;
}
