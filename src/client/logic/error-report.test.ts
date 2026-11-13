import { describe, expect, it, vi } from 'vitest';
import { ERROR_FIELDS } from '../../core/error-log.ts';
import {
  apiFailure,
  createReporter,
  describeError,
  failedCall,
  reportContextLine,
  reportFormHTML,
  type ReporterOptions,
} from './error-report.ts';

describe('describeError', () => {
  it('takes name, message and stack of an error, else the text', () => {
    const error = new RangeError('too far');
    expect(describeError(error)).toEqual({
      message: 'RangeError: too far',
      detail: error.stack,
    });
    const bare = new Error('bare');
    bare.stack = undefined;
    expect(describeError(bare)).toEqual({ message: 'Error: bare', detail: '' });
    expect(describeError('plain')).toEqual({ message: 'plain', detail: '' });
    expect(describeError(Object.create(null))).toEqual({
      message: 'Unprintable error',
      detail: '',
    });
  });
});

describe('apiFailure', () => {
  it('names the status and path, without the query', () => {
    expect(apiFailure('/api/state?planet=p1', 500, 'id')).toEqual({
      kind: 'api',
      message: 'HTTP 500: /api/state',
      detail: '',
      requestId: 'id',
    });
    expect(apiFailure('/api/action', null)).toEqual({
      kind: 'api',
      message: 'No answer: /api/action',
      detail: '',
      requestId: null,
    });
  });

  it('counts 500 and above as failed, refusals and 401 not', () => {
    expect(failedCall(500)).toBe(true);
    expect(failedCall(503)).toBe(true);
    expect(failedCall(499)).toBe(false);
    expect(failedCall(400)).toBe(false);
    expect(failedCall(401)).toBe(false);
  });
});

function reporter(over: Partial<ReporterOptions> = {}) {
  const sent: Record<string, unknown>[] = [];
  const clock = { t: 0 };
  const context = {
    signedIn: true,
    page: 'fleet',
    version: '26.11.21',
    browser: 'Firefox',
  };
  const report = createReporter({
    send: (body) => {
      sent.push(body as Record<string, unknown>);
      return Promise.resolve();
    },
    context: () => context,
    now: () => clock.t,
    ...over,
  });
  return { report, sent, clock, context };
}

const ERROR = {
  kind: 'error',
  message: 'TypeError: x',
  detail: 'at y',
} as const;

describe('createReporter', () => {
  it('sends the error with page, version and browser', () => {
    const { report, sent } = reporter();
    report(ERROR);
    report({ ...ERROR, kind: 'api', requestId: 'r1' });
    expect(sent).toEqual([
      {
        kind: 'error',
        message: 'TypeError: x',
        detail: 'at y',
        requestId: null,
        page: 'fleet',
        version: '26.11.21',
        browser: 'Firefox',
      },
      expect.objectContaining({ kind: 'api', requestId: 'r1' }),
    ]);
  });

  it('cuts every field to its limit before sending', () => {
    const { report, sent, context } = reporter();
    context.page = 'p'.repeat(100);
    context.version = 'v'.repeat(100);
    context.browser = 'b'.repeat(1000);
    report({
      kind: 'error',
      message: 'm'.repeat(1000),
      detail: 'd'.repeat(9000),
    });
    const body = sent[0]!;
    expect(String(body.message)).toHaveLength(ERROR_FIELDS.message);
    expect(String(body.detail)).toHaveLength(ERROR_FIELDS.detail);
    expect(String(body.page)).toHaveLength(ERROR_FIELDS.page);
    expect(String(body.version)).toHaveLength(ERROR_FIELDS.version);
    expect(String(body.browser)).toHaveLength(ERROR_FIELDS.browser);
  });

  it('sends nothing while nobody is signed in (the login page)', () => {
    const { report, sent, context } = reporter();
    context.signedIn = false;
    for (let i = 0; i < 30; i++) report(ERROR);
    expect(sent).toEqual([]);
    context.signedIn = true;
    report(ERROR);
    expect(sent).toHaveLength(1);
  });

  it('sends at most 20 a minute', () => {
    const { report, sent, clock } = reporter();
    for (let i = 0; i < 25; i++) report(ERROR);
    expect(sent).toHaveLength(20);
    clock.t = 59999;
    report(ERROR);
    expect(sent).toHaveLength(20);
    clock.t = 60000;
    for (let i = 0; i < 25; i++) report(ERROR);
    expect(sent).toHaveLength(40);
  });

  it('swallows a failed send and never reports itself', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const send = vi.fn(() => Promise.reject(new Error('offline')));
    const { report } = reporter({ send });
    report(ERROR);
    const throwing = reporter({
      send: () => {
        throw new Error('sync');
      },
    });
    expect(() => throwing.report(ERROR)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(send).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('ignores an error raised while it is reporting', () => {
    const calls: number[] = [];
    let again: (() => void) | null = null;
    const { report } = reporter({
      send: () => {
        calls.push(1);
        again?.();
        return Promise.resolve();
      },
    });
    again = () => report(ERROR);
    report(ERROR);
    expect(calls).toHaveLength(1);
    again = null;
    report(ERROR);
    expect(calls).toHaveLength(2);
  });

  it('keeps working after the context fails', () => {
    let broken = true;
    const sent: unknown[] = [];
    const report = createReporter({
      send: (body) => {
        sent.push(body);
        return Promise.resolve();
      },
      context: () => {
        if (broken) throw new Error('no ui');
        return { signedIn: true, page: '', version: '', browser: '' };
      },
      now: () => 0,
    });
    expect(() => report(ERROR)).not.toThrow();
    broken = false;
    report(ERROR);
    expect(sent).toHaveLength(1);
  });
});

describe('the form „Problem melden“', () => {
  const context = {
    source: 'toast' as const,
    page: 'fleet',
    version: '26.11.21',
    requestId: '0f8e2b7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
    message: 'Serverfehler. <b>',
  };

  it('names page, version, request and message, escaped', () => {
    expect(reportContextLine(context)).toBe(
      'Seite: fleet · Version: 26.11.21 · Letzter Vorgang: 0f8e2b7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b · Meldung: Serverfehler. &lt;b&gt;',
    );
    expect(
      reportContextLine({
        source: 'form',
        page: 'help',
        version: '',
        requestId: null,
      }),
    ).toBe('Seite: help · Version: unbekannt · Letzter Vorgang: –');
  });

  it('sends the context in hidden fields with a text of up to 1,000 characters', () => {
    const html = reportFormHTML('reportform-dialog', context);
    expect(html).toContain('<form id="reportform-dialog" class="report-form">');
    for (const [name, value] of [
      ['source', 'toast'],
      ['page', 'fleet'],
      ['version', '26.11.21'],
      ['requestId', context.requestId],
      ['message', 'Serverfehler. &lt;b&gt;'],
    ])
      expect(html).toContain(
        `<input type="hidden" name="${name}" value="${value}">`,
      );
    expect(html).toContain(
      '<label for="reportform-dialog-text">Was ist passiert?</label>',
    );
    expect(html).toContain(
      '<textarea id="reportform-dialog-text" name="text" maxlength="1000" rows="4" required></textarea>',
    );
    expect(html).toContain('<button type="submit">Absenden</button>');
    const plain = reportFormHTML('reportform', {
      source: 'form',
      page: 'help',
      version: '',
      requestId: null,
    });
    expect(plain).toContain('<input type="hidden" name="requestId" value="">');
    expect(plain).toContain('<input type="hidden" name="message" value="">');
  });
});
