import { describe, expect, it } from 'vitest';
import { loadConfig, NUMBERS, SECRETS, SETTINGS } from './config.ts';

const noFile: (path: string) => string = () => {
  throw new Error('no file');
};
const base = { NOVA_PUBLIC_URL: 'https://game.example.org' };

const ok = (
  env: Record<string, string>,
  read: (p: string) => string = noFile,
) => {
  const r = loadConfig(env, read);
  if ('errors' in r) throw new Error(r.errors.join('\n'));
  return r.config;
};
const errors = (
  env: Record<string, string>,
  read: (p: string) => string = noFile,
): string[] => {
  const r = loadConfig(env, read);
  return 'errors' in r ? r.errors : [];
};

describe('configuration', () => {
  it('has safe defaults', () => {
    expect(ok(base)).toEqual({
      host: '127.0.0.1',
      port: 8080,
      dataDir: './data',
      publicUrl: 'https://game.example.org',
      secureCookies: true,
      trustProxy: false,
      sessionDays: 30,
      inviteDays: 7,
      rateLimitAttempts: 20,
      rateLimitMinutes: 10,
      emailLoginCodes: false,
      smtp: null,
    });
  });

  it('requires SMTP for email login codes', () => {
    expect(errors({ ...base, NOVA_EMAIL_LOGIN_CODES: '1' })).toContain(
      'NOVA_EMAIL_LOGIN_CODES requires SMTP_HOST and mail settings.',
    );
    expect(
      ok({
        ...base,
        NOVA_EMAIL_LOGIN_CODES: '1',
        SMTP_HOST: 'mail.example.org',
        SMTP_PORT: '465',
        MAIL_FROM: 'game@example.org',
      }).emailLoginCodes,
    ).toBe(true);
  });

  it('reads the values and trims them', () => {
    const c = ok({
      NOVA_PUBLIC_URL: ' http://localhost:8080/ ',
      NOVA_HOST: '0.0.0.0',
      NOVA_PORT: '9000',
      NOVA_DATA_DIR: '/data',
      NOVA_TRUST_PROXY: '1',
      NOVA_SESSION_DAYS: '365',
      NOVA_INVITE_DAYS: '1',
      NOVA_RATE_LIMIT_ATTEMPTS: '5',
      NOVA_RATE_LIMIT_MINUTES: '1440',
    });
    expect(c).toMatchObject({
      publicUrl: 'http://localhost:8080',
      secureCookies: false,
      host: '0.0.0.0',
      port: 9000,
      dataDir: '/data',
      trustProxy: true,
      sessionDays: 365,
      inviteDays: 1,
      rateLimitAttempts: 5,
      rateLimitMinutes: 1440,
    });
    expect(ok({ ...base, NOVA_TRUST_PROXY: '0', NOVA_PORT: '' }).port).toBe(
      8080,
    );
  });

  it('requires a public address without a path', () => {
    expect(errors({})).toEqual([
      'NOVA_PUBLIC_URL is required: the address of the game as players open it.',
    ]);
    for (const bad of [
      'ftp://x.org',
      'not a url',
      'https://x.org/game',
      'https://x.org/?a=1',
    ])
      expect(errors({ NOVA_PUBLIC_URL: bad })).toEqual([
        `NOVA_PUBLIC_URL: an http(s) address without a path, got "${bad}".`,
      ]);
  });

  it('reports every invalid number and flag at once', () => {
    expect(
      errors({
        ...base,
        NOVA_PORT: '0',
        NOVA_SESSION_DAYS: '366',
        NOVA_INVITE_DAYS: '1.5',
        NOVA_TRUST_PROXY: 'yes',
      }),
    ).toEqual([
      'NOVA_PORT: a whole number from 1 to 65535, got "0".',
      'NOVA_TRUST_PROXY: 0 or 1, got "yes".',
      'NOVA_SESSION_DAYS: a whole number from 1 to 365, got "366".',
      'NOVA_INVITE_DAYS: a whole number from 1 to 30, got "1.5".',
    ]);
  });

  it('reads SMTP with the TLS mode', () => {
    const smtp = {
      SMTP_HOST: 'mail.example.org',
      SMTP_PORT: '587',
      MAIL_FROM: 'game@example.org',
    };
    expect(ok({ ...base, ...smtp }).smtp).toEqual({
      host: 'mail.example.org',
      port: 587,
      tls: 'true',
      username: '',
      password: '',
      from: 'game@example.org',
    });
    expect(ok({ ...base, ...smtp, SMTP_TLS: 'starttls' }).smtp?.tls).toBe(
      'starttls',
    );
    expect(ok({ ...base, ...smtp, SMTP_TLS: 'false' }).smtp?.tls).toBe('false');
    expect(errors({ ...base, ...smtp, SMTP_TLS: 'yes' })).toEqual([
      'SMTP_TLS: true, starttls or false, got "yes".',
    ]);
    expect(errors({ ...base, SMTP_HOST: 'h' })).toEqual([
      'SMTP_PORT is required when SMTP_HOST is set.',
      'MAIL_FROM is required when SMTP_HOST is set: the sender address of the invitations.',
    ]);
    expect(errors({ ...base, ...smtp, SMTP_USERNAME: 'me' })).toEqual([
      'SMTP_USERNAME is set but SMTP_PASSWORD is empty.',
    ]);
  });

  it('reads secrets from files and refuses both ways at once', () => {
    const files: Record<string, string> = {
      '/run/secrets/pw': 'p@ss word\n',
      '/run/secrets/user': 'me',
    };
    const read = (f: string): string => {
      if (!(f in files)) throw new Error('missing');
      return files[f]!;
    };
    const smtp = { SMTP_HOST: 'h', SMTP_PORT: '465', MAIL_FROM: 'a@b.c' };
    const c = ok(
      {
        ...base,
        ...smtp,
        SMTP_USERNAME_FILE: '/run/secrets/user',
        SMTP_PASSWORD_FILE: '/run/secrets/pw',
      },
      read,
    );
    expect(c.smtp).toMatchObject({ username: 'me', password: 'p@ss word' });
    expect(
      ok({ ...base, ...smtp, SMTP_USERNAME: 'u', SMTP_PASSWORD: ' direct ' })
        .smtp?.password,
    ).toBe(' direct ');
    expect(
      errors(
        {
          ...base,
          ...smtp,
          SMTP_PASSWORD: 'x',
          SMTP_PASSWORD_FILE: '/run/secrets/pw',
        },
        read,
      ),
    ).toEqual([
      'SMTP_PASSWORD and SMTP_PASSWORD_FILE are both set; use one of them.',
    ]);
    expect(
      errors({ ...base, ...smtp, SMTP_PASSWORD_FILE: '/nope' }, read),
    ).toEqual([
      'SMTP_PASSWORD_FILE: cannot read /nope. It must exist and be readable for the user of the server (uid 1000 in the image).',
    ]);
  });

  it('lists every variable for the documentation', () => {
    expect(SETTINGS).toContain('NOVA_PUBLIC_URL');
    for (const n of Object.values(NUMBERS)) expect(SETTINGS).toContain(n.name);
    for (const s of SECRETS) expect(SETTINGS).toContain(s);
  });
});
