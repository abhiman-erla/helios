import { parseId, validateTask } from '../src/validate.js';

// Unit tests: pure functions, no database, run in milliseconds.
describe('validateTask', () => {
  test('accepts a valid new task and trims the title', () => {
    const { value, errors } = validateTask({ title: '  Write Dockerfile  ', description: 'multi-stage' });
    expect(errors).toEqual([]);
    expect(value).toEqual({ title: 'Write Dockerfile', description: 'multi-stage' });
  });

  test('requires a title on create', () => {
    expect(validateTask({}).errors).toContain('title is required');
  });

  test('rejects a blank title', () => {
    expect(validateTask({ title: '   ' }).errors).toContain('title must be a non-empty string');
  });

  test('rejects an unknown status', () => {
    const { errors } = validateTask({ title: 'x', status: 'blocked' });
    expect(errors[0]).toMatch(/status must be one of/);
  });

  test('rejects a title that is too long', () => {
    expect(validateTask({ title: 'a'.repeat(201) }).errors[0]).toMatch(/at most 200/);
  });

  test('rejects non-object bodies', () => {
    expect(validateTask(null).errors).toEqual(['body must be a JSON object']);
    expect(validateTask([1, 2]).errors).toEqual(['body must be a JSON object']);
  });

  test('partial mode allows a single field', () => {
    const { value, errors } = validateTask({ status: 'done' }, { partial: true });
    expect(errors).toEqual([]);
    expect(value).toEqual({ status: 'done' });
  });

  test('partial mode rejects an empty update', () => {
    expect(validateTask({}, { partial: true }).errors[0]).toMatch(/at least one/);
  });
});

describe('parseId', () => {
  test.each([
    ['1', 1],
    ['42', 42],
    ['0', null],
    ['-1', null],
    ['abc', null],
    ['1.5', null],
    ['99999999999', null],
  ])('parseId(%p) -> %p', (raw, expected) => {
    expect(parseId(raw)).toBe(expected);
  });
});
