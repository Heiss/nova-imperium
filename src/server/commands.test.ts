import { describe, expect, it } from 'vitest';
import { runCommand, USAGE } from './commands.ts';
import { addUser, testConfig, testCtx } from './test-helpers.ts';

function run(args: string[], mailer: Parameters<typeof runCommand>[2] = null) {
  const ctx = testCtx();
  addUser(ctx, 'Anna');
  const out: string[] = [];
  const err: string[] = [];
  const io = {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  };
  return {
    ctx,
    out,
    err,
    exec: (a = args, m = mailer) => runCommand(ctx, testConfig(), m, a, io),
  };
}

describe('operator commands', () => {
  it('make a player admin and take it back', async () => {
    const r = run(['admin', 'anna']);
    expect(await r.exec()).toBe(0);
    expect(r.out).toEqual(['Anna is now admin.']);
    expect(r.ctx.store.userByName('Anna')!.admin).toBe(true);
    expect(await r.exec(['admins'])).toBe(0);
    expect(r.out[1]).toBe('Anna');
    expect(await r.exec(['unadmin', 'Anna'])).toBe(0);
    expect(r.out[2]).toBe('Anna is no longer admin.');
    expect(await r.exec(['admins'])).toBe(0);
    expect(r.out[3]).toBe('No admin yet.');
  });

  it('name an unknown player', async () => {
    const r = run(['admin', 'Bob']);
    expect(await r.exec()).toBe(1);
    expect(r.err).toEqual(['No player named "Bob".']);
    expect(await r.exec(['admin'])).toBe(1);
    expect(r.err[1]).toBe('No player named "".');
  });

  it('create an invitation and print the link', async () => {
    const sent: string[] = [];
    const r = run(
      ['invite', 'new@example.org'],
      async (m) => void sent.push(m.to),
    );
    expect(await r.exec()).toBe(0);
    expect(r.out[0]).toMatch(/^Invitation for new@example.org, valid until /);
    expect(r.out[1]).toMatch(/^http:\/\/localhost:8080\/#invite=/);
    expect(r.out[2]).toBe('The invitation mail was sent.');
    expect(sent).toEqual(['new@example.org']);
    expect(await r.exec(['invite', 'other@example.org'], null)).toBe(0);
    expect(r.out).toHaveLength(5);
  });

  it('report a failed mail but keep the invitation', async () => {
    const r = run(['invite', 'new@example.org'], async () =>
      Promise.reject(new Error('down')),
    );
    expect(await r.exec()).toBe(0);
    expect(r.err).toEqual([
      'The mail could not be sent (down); give the link yourself.',
    ]);
    expect(r.ctx.store.openInvitations(r.ctx.now())).toHaveLength(1);
  });

  it('report errors and the usage', async () => {
    const r = run(['invite', 'bad']);
    expect(await r.exec()).toBe(1);
    expect(r.err).toEqual(['Bitte eine gültige E-Mail-Adresse eingeben.']);
    expect(await r.exec(['help'])).toBe(2);
    expect(await r.exec([])).toBe(2);
    expect(r.err[1]).toBe(USAGE);
  });
});
