import { describe, expect, it, vi } from 'vitest';
import { createApi, RETRY_AFTER_MS, type TransportDeps } from './transport.ts';

const answer = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers,
  });

function setup(...answers: (Response | Error)[]) {
  const queue = [...answers];
  const fetch = vi.fn(async () => {
    const next = queue.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  const deps = {
    fetch: fetch as unknown as typeof globalThis.fetch,
    report: vi.fn(),
    maintenance: vi.fn(),
    signedOut: vi.fn((error: unknown): never => {
      throw new Error(`signed out: ${String(error)}`);
    }),
    requestId: vi.fn(),
    wait: vi.fn(async () => undefined),
  } satisfies TransportDeps;
  return { api: createApi(deps), fetch, deps };
}

describe('a call', () => {
  it('gets without a body and posts with one, with the cookie', async () => {
    const { api, fetch } = setup(
      answer(200, { ok: 1 }),
      answer(200, { ok: 2 }),
    );
    expect(await api('/api/state')).toEqual({ ok: 1 });
    expect(await api('/api/x', { a: 1 })).toEqual({ ok: 2 });
    expect(fetch.mock.calls).toEqual([
      [
        '/api/state',
        {
          method: 'GET',
          headers: {},
          body: undefined,
          credentials: 'same-origin',
        },
      ],
      [
        '/api/x',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"a":1}',
          credentials: 'same-origin',
        },
      ],
    ]);
  });

  it('hands the request id on and tells no id when there is none', async () => {
    const { api, deps } = setup(
      answer(200, {}, { 'x-request-id': 'r1' }),
      answer(200, {}),
    );
    await api('/a');
    await api('/b');
    expect(deps.requestId.mock.calls).toEqual([['r1']]);
  });

  it('throws the words of the server for a refusal and reports no 4xx', async () => {
    const { api, deps } = setup(answer(400, { error: 'Zu wenig Metall.' }));
    await expect(api('/api/act', {})).rejects.toThrow('Zu wenig Metall.');
    expect(deps.report).not.toHaveBeenCalled();
  });

  it('says „Fehler“ when the refusal has no words', async () => {
    const { api } = setup(answer(404, {}));
    await expect(api('/api/act', {})).rejects.toThrow(/^Fehler$/);
  });

  it('answers a body that is no JSON with „Keine Antwort vom Server.“', async () => {
    const { api } = setup(answer(502, 'bad gateway'));
    await expect(api('/api/state')).rejects.toThrow(
      'Keine Antwort vom Server.',
    );
  });

  it('reports a server error with its id and names the id in the error', async () => {
    const { api, deps } = setup(
      answer(500, { error: 'Interner Fehler.' }, { 'x-request-id': 'abc' }),
    );
    await expect(api('/api/act', {})).rejects.toThrow(
      'Interner Fehler. Vorgang: abc',
    );
    expect(deps.report).toHaveBeenCalledWith({
      kind: 'api',
      message: 'HTTP 500: /api/act',
      detail: '',
      requestId: 'abc',
    });
  });

  it('reports a call without an answer and passes the failure on', async () => {
    const down = new TypeError('network');
    const { api, deps } = setup(down);
    await expect(api('/api/state?planet=p1')).rejects.toBe(down);
    expect(deps.report).toHaveBeenCalledWith({
      kind: 'api',
      message: 'No answer: /api/state',
      detail: '',
      requestId: null,
    });
  });
});

describe('the session is gone', () => {
  it('hands the 401 to signedOut, which stops the caller', async () => {
    const { api, deps } = setup(answer(401, { error: 'Bitte einloggen.' }));
    await expect(api('/api/state')).rejects.toThrow(
      'signed out: Bitte einloggen.',
    );
    expect(deps.signedOut).toHaveBeenCalledWith('Bitte einloggen.');
    expect(deps.report).not.toHaveBeenCalled();
  });

  it('does not retry and does not report a 401', async () => {
    const { api, fetch } = setup(answer(401, {}));
    await expect(api('/api/act', {})).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('maintenance', () => {
  it('shows the banner with the text of the server and stops', async () => {
    const { api, deps } = setup(
      answer(
        503,
        { error: 'Wir wechseln die Datenbank.' },
        {
          'nova-maintenance': '1',
        },
      ),
    );
    await expect(api('/api/state')).rejects.toThrow(
      'Wir wechseln die Datenbank.',
    );
    expect(deps.maintenance).toHaveBeenCalledWith(
      'Wir wechseln die Datenbank.',
    );
    expect(deps.report).not.toHaveBeenCalled();
  });

  it('shows the fallback text for a maintenance answer without words', async () => {
    const { api, deps } = setup(answer(503, {}, { 'nova-maintenance': '1' }));
    await expect(api('/api/state')).rejects.toThrow();
    expect(deps.maintenance.mock.calls[0]![0]).toMatch(/gewartet/);
  });

  it('takes a 503 without the header for a server error', async () => {
    const { api, deps } = setup(answer(503, { error: 'Down.' }));
    await expect(api('/api/state')).rejects.toThrow('Down.');
    expect(deps.maintenance).not.toHaveBeenCalled();
    expect(deps.report).toHaveBeenCalledTimes(1);
  });
});

describe('the retry of an action', () => {
  const busy = () => answer(503, { code: 'ACTION_DB_BUSY', error: 'Busy.' });

  it('sends a busy action once more after a pause and returns that answer', async () => {
    const { api, fetch, deps } = setup(busy(), answer(200, { done: true }));
    expect(await api('/api/act', { type: 'x' })).toEqual({ done: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledWith(RETRY_AFTER_MS);
    expect(deps.report).not.toHaveBeenCalled();
  });

  it('tries only once more, then reports the failure', async () => {
    const { api, fetch, deps } = setup(busy(), busy());
    await expect(api('/api/act', {})).rejects.toThrow('Busy.');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deps.report).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the caller asked not to', async () => {
    const { api, fetch } = setup(busy());
    await expect(api('/api/act', {}, false)).rejects.toThrow('Busy.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry another 503 or another code', async () => {
    const { api, fetch } = setup(
      answer(503, { code: 'OTHER', error: 'Nein.' }),
    );
    await expect(api('/api/act', {})).rejects.toThrow('Nein.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries after a 401 never, even in the middle of a retry', async () => {
    const { api, deps } = setup(busy(), answer(401, { error: 'Weg.' }));
    await expect(api('/api/act', {})).rejects.toThrow('signed out: Weg.');
    expect(deps.signedOut).toHaveBeenCalledTimes(1);
  });
});
