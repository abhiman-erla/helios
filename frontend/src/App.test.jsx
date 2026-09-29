import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

// The frontend tests don't need a real backend: we replace `fetch` with a fake
// that returns canned responses. (The backend's own tests cover the real API.)
function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

const sampleTasks = [
  { id: 2, title: 'Write Compose file', description: '', status: 'in_progress' },
  { id: 1, title: 'Write Dockerfile', description: 'multi-stage', status: 'done' },
];

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('loads and shows tasks from the API', async () => {
  fetchMock.mockReturnValueOnce(jsonResponse(200, sampleTasks));
  render(<App />);

  expect(await screen.findByText('Write Compose file')).toBeInTheDocument();
  expect(screen.getByText('Write Dockerfile')).toBeInTheDocument();
  expect(screen.getByText('Done: 1')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/tasks', expect.any(Object));
});

test('shows an empty state when there are no tasks', async () => {
  fetchMock.mockReturnValueOnce(jsonResponse(200, []));
  render(<App />);
  expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument();
});

test('creates a task and adds it to the top of the list', async () => {
  const user = userEvent.setup();
  fetchMock
    .mockReturnValueOnce(jsonResponse(200, sampleTasks))
    .mockReturnValueOnce(
      jsonResponse(201, { id: 3, title: 'Add CI', description: '', status: 'todo' }),
    );
  render(<App />);
  await screen.findByText('Write Compose file');

  await user.type(screen.getByLabelText('Title'), 'Add CI');
  await user.click(screen.getByRole('button', { name: 'Add task' }));

  expect(await screen.findByText('Add CI')).toBeInTheDocument();
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toBe('/api/tasks');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual({ title: 'Add CI', description: '' });
  expect(screen.getByLabelText('Title')).toHaveValue('');
});

test('changes a task status', async () => {
  const user = userEvent.setup();
  fetchMock
    .mockReturnValueOnce(jsonResponse(200, sampleTasks))
    .mockReturnValueOnce(jsonResponse(200, { ...sampleTasks[0], status: 'done' }));
  render(<App />);
  await screen.findByText('Write Compose file');

  await user.selectOptions(screen.getByLabelText('Status for Write Compose file'), 'done');

  expect(await screen.findByText('Done: 2')).toBeInTheDocument();
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toBe('/api/tasks/2');
  expect(JSON.parse(options.body)).toEqual({ status: 'done' });
});

test('deletes a task', async () => {
  const user = userEvent.setup();
  fetchMock
    .mockReturnValueOnce(jsonResponse(200, sampleTasks))
    .mockReturnValueOnce(Promise.resolve({ ok: true, status: 204 }));
  render(<App />);
  await screen.findByText('Write Dockerfile');

  await user.click(screen.getByRole('button', { name: 'Delete Write Dockerfile' }));

  expect(screen.queryByText('Write Dockerfile')).not.toBeInTheDocument();
  const list = screen.getByRole('list');
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
});

test('shows the API error message when loading fails', async () => {
  fetchMock.mockReturnValueOnce(jsonResponse(500, { error: 'internal server error' }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load tasks: internal server error",
  );
});
