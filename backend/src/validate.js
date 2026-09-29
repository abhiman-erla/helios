export const STATUSES = ['todo', 'in_progress', 'done'];

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

// Returns { value, errors }. `partial` is for PATCH, where every field is optional.
export function validateTask(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { value, errors: ['body must be a JSON object'] };
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      errors.push('title must be a non-empty string');
    } else if (input.title.trim().length > TITLE_MAX) {
      errors.push(`title must be at most ${TITLE_MAX} characters`);
    } else {
      value.title = input.title.trim();
    }
  } else if (!partial) {
    errors.push('title is required');
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string') {
      errors.push('description must be a string');
    } else if (input.description.length > DESCRIPTION_MAX) {
      errors.push(`description must be at most ${DESCRIPTION_MAX} characters`);
    } else {
      value.description = input.description;
    }
  }

  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status)) {
      errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    } else {
      value.status = input.status;
    }
  }

  if (partial && errors.length === 0 && Object.keys(value).length === 0) {
    errors.push('provide at least one of: title, description, status');
  }

  return { value, errors };
}

// Route ids are strings; only accept positive integers that fit Postgres `integer`.
export function parseId(raw) {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && id <= 2_147_483_647 ? id : null;
}
