import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadErrors } from './download.ts';

interface Link {
  href?: string;
  download?: string;
  hidden?: boolean;
  click: () => void;
  remove: () => void;
}

let links: Link[];
let fetched: { url: string; init: RequestInit }[];

const reply = (over: Partial<Response> & { header?: string | null } = {}) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({}),
    headers: { get: () => over.header ?? null },
    blob: async () => new Blob(['zip']),
    ...over,
  }) as unknown as Response;

const answer = (r: Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      fetched.push({ url, init });
      return r;
    }),
  );

beforeEach(() => {
  links = [];
  fetched = [];
  vi.useFakeTimers();
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:x',
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('document', {
    createElement: () => {
      const link: Link = { click: vi.fn(), remove: vi.fn() };
      links.push(link);
      return link;
    },
    body: { append: vi.fn() },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const lost = (error: unknown): never => {
  throw new Error(`signed out: ${String(error)}`);
};

describe('the download of the errors', () => {
  it('asks the server for the range and saves the ZIP under the name it gives', async () => {
    answer(reply({ header: 'attachment; filename="fehler-1.zip"' }));
    await downloadErrors({ since: 1, until: 2 }, lost);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]!.url).toBe('/api/admin/errors/download');
    expect(JSON.parse(String(fetched[0]!.init.body))).toEqual({
      since: 1,
      until: 2,
    });
    expect(links[0]).toMatchObject({
      href: 'blob:x',
      download: 'fehler-1.zip',
      hidden: true,
    });
    expect(links[0]!.click).toHaveBeenCalled();
    expect(links[0]!.remove).toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('names the file itself when the server gives no name', async () => {
    answer(reply());
    await downloadErrors({}, lost);
    expect(links[0]!.download).toBe('nova-imperium-fehler.zip');
  });

  it('throws the words of the server on a refusal', async () => {
    answer(
      reply({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Zu groß.' }),
      }),
    );
    await expect(downloadErrors({}, lost)).rejects.toThrow('Zu groß.');
    expect(links).toHaveLength(0);
  });

  it('says so when the refusal has no words', async () => {
    answer(
      reply({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('no json');
        },
      }),
    );
    await expect(downloadErrors({}, lost)).rejects.toThrow(
      'Der Download ist fehlgeschlagen.',
    );
  });

  it('hands a lost session (401) to the way back to the login', async () => {
    answer(
      reply({ ok: false, status: 401, json: async () => ({ error: 'weg' }) }),
    );
    await expect(downloadErrors({}, lost)).rejects.toThrow('signed out: weg');
  });
});
