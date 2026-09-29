// Versioned schema change. node-pg-migrate records it in `pgmigrations`,
// so every environment (local, CI, dev, prod) ends up with the same tables.

export const up = (pgm) => {
  pgm.createTable('tasks', {
    id: 'id', // serial primary key
    title: { type: 'varchar(200)', notNull: true },
    description: { type: 'text', notNull: true, default: '' },
    status: { type: 'varchar(20)', notNull: true, default: 'todo' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Enforce valid statuses in the database too, not only in the API.
  pgm.addConstraint('tasks', 'tasks_status_check', {
    check: "status IN ('todo', 'in_progress', 'done')",
  });
};

export const down = (pgm) => {
  pgm.dropTable('tasks');
};
