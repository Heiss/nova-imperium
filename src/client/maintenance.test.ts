import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Node {
  id?: string;
  className?: string;
  textContent?: string;
  attrs: Record<string, string>;
  setAttribute(k: string, v: string): void;
  remove(): void;
}

let page: Node | null;
let m: typeof import('./maintenance.ts');
let healthz: () => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  m = await import('./maintenance.ts');
  vi.useFakeTimers();
  page = null;
  vi.stubGlobal('document', {
    querySelector: (sel: string) => (sel === '#maintenance' ? page : null),
    createElement: () => {
      const node: Node = {
        attrs: {},
        setAttribute(k, v) {
          node.attrs[k] = v;
        },
        remove() {
          page = null;
        },
      };
      return node;
    },
    body: {
      prepend: (node: Node) => {
        page = node;
      },
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => healthz()),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const health = (status: number, body: object) => async () =>
  new Response(JSON.stringify(body), { status });

describe('the maintenance banner', () => {
  it('shows the text as a status and keeps one banner', () => {
    healthz = health(503, { maintenance: true });
    m.showMaintenance('Gleich wieder da.');
    const banner = page!;
    expect(banner.textContent).toBe('Wartung – Gleich wieder da.');
    expect(banner.attrs.role).toBe('status');
    m.showMaintenance('Noch ein Moment.');
    expect(page).toBe(banner);
    expect(banner.textContent).toBe('Wartung – Noch ein Moment.');
    expect(m.maintenanceText()).toBe('Noch ein Moment.');
  });

  it('checks every 15 seconds and goes when the game is back', async () => {
    const back = vi.fn();
    m.whenBack(back);
    healthz = health(503, { maintenance: true });
    m.showMaintenance('Wartung.');
    await vi.advanceTimersByTimeAsync(15000);
    expect(back).not.toHaveBeenCalled();
    expect(page).not.toBeNull();
    healthz = health(200, { ok: true });
    await vi.advanceTimersByTimeAsync(15000);
    expect(back).toHaveBeenCalledTimes(1);
    expect(page).toBeNull();
    expect(m.maintenanceText()).toBeNull();
  });

  it('waits on when the health check does not answer', async () => {
    const back = vi.fn();
    m.whenBack(back);
    healthz = async () => {
      throw new TypeError('down');
    };
    m.showMaintenance('Wartung.');
    await vi.advanceTimersByTimeAsync(30000);
    expect(back).not.toHaveBeenCalled();
    healthz = health(200, { ok: true });
    await vi.advanceTimersByTimeAsync(15000);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
