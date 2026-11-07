// Settings of the server from environment variables. Secrets can also come
// from a file (`NAME_FILE`, for Docker secrets). An invalid value stops the
// start with all errors at once (fail closed). The table in the docs and
// `.env.example` must match SETTINGS; a test checks it.

export interface SmtpConfig {
  host: string;
  port: number;
  tls: 'true' | 'starttls' | 'false';
  username: string;
  password: string;
  from: string;
}

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  publicUrl: string;
  secureCookies: boolean;
  trustProxy: boolean;
  sessionDays: number;
  inviteDays: number;
  rateLimitAttempts: number;
  rateLimitMinutes: number;
  emailLoginCodes: boolean;
  webPush: boolean;
  smtp: SmtpConfig | null;
}

type Env = Record<string, string | undefined>;
export type ReadFile = (path: string) => string;

export interface NumberSpec {
  name: string;
  def: number;
  min: number;
  max: number;
}

export const NUMBERS = {
  port: { name: 'NOVA_PORT', def: 8080, min: 1, max: 65535 },
  sessionDays: { name: 'NOVA_SESSION_DAYS', def: 30, min: 1, max: 365 },
  inviteDays: { name: 'NOVA_INVITE_DAYS', def: 7, min: 1, max: 30 },
  rateLimitAttempts: {
    name: 'NOVA_RATE_LIMIT_ATTEMPTS',
    def: 20,
    min: 1,
    max: 1000,
  },
  rateLimitMinutes: {
    name: 'NOVA_RATE_LIMIT_MINUTES',
    def: 10,
    min: 1,
    max: 1440,
  },
} as const satisfies Record<string, NumberSpec>;

/** Every variable the server reads, for the docs and the sync test. */
export const SETTINGS = [
  'NOVA_PUBLIC_URL',
  'NOVA_HOST',
  'NOVA_DATA_DIR',
  'NOVA_TRUST_PROXY',
  'NOVA_EMAIL_LOGIN_CODES',
  'NOVA_WEB_PUSH',
  ...Object.values(NUMBERS).map((n) => n.name),
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_TLS',
  'SMTP_USERNAME',
  'SMTP_PASSWORD',
  'MAIL_FROM',
] as const;

/** Variables that may come from a file through NAME_FILE. */
export const SECRETS = ['SMTP_USERNAME', 'SMTP_PASSWORD'] as const;

class Collector {
  errors: string[] = [];
  private env: Env;
  private readFile: ReadFile;
  constructor(env: Env, readFile: ReadFile) {
    this.env = env;
    this.readFile = readFile;
  }

  /** An empty variable counts as unset (Compose passes unset ones like that). */
  text(name: string): string {
    return (this.env[name] ?? '').trim();
  }

  secret(name: string): string {
    const direct = this.env[name] ?? '';
    const file = this.text(`${name}_FILE`);
    if (direct && file) {
      this.errors.push(
        `${name} and ${name}_FILE are both set; use one of them.`,
      );
      return '';
    }
    if (!file) return direct;
    try {
      return this.readFile(file).replace(/\r?\n$/, '');
    } catch {
      this.errors.push(
        `${name}_FILE: cannot read ${file}. It must exist and be readable for the user of the server (uid 1000 in the image).`,
      );
      return '';
    }
  }

  number(spec: NumberSpec): number {
    const raw = this.text(spec.name);
    if (!raw) return spec.def;
    if (!/^\d+$/.test(raw) || +raw < spec.min || +raw > spec.max) {
      this.errors.push(
        `${spec.name}: a whole number from ${spec.min} to ${spec.max}, got "${raw}".`,
      );
      return spec.def;
    }
    return +raw;
  }

  flag(name: string): boolean {
    const raw = this.text(name);
    if (raw === '' || raw === '0') return false;
    if (raw === '1') return true;
    this.errors.push(`${name}: 0 or 1, got "${raw}".`);
    return false;
  }
}

function publicUrl(c: Collector): string {
  const raw = c.text('NOVA_PUBLIC_URL').replace(/\/+$/, '');
  if (!raw) {
    c.errors.push(
      'NOVA_PUBLIC_URL is required: the address of the game as players open it.',
    );
    return '';
  }
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    // reported below
  }
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search
  ) {
    c.errors.push(
      `NOVA_PUBLIC_URL: an http(s) address without a path, got "${raw}".`,
    );
    return '';
  }
  return url.origin;
}

const TLS_MODES = ['true', 'starttls', 'false'] as const;

function smtp(c: Collector): SmtpConfig | null {
  const host = c.text('SMTP_HOST');
  const username = c.secret('SMTP_USERNAME');
  const password = c.secret('SMTP_PASSWORD');
  if (!host) return null;
  const port = c.number({ name: 'SMTP_PORT', def: 0, min: 1, max: 65535 });
  if (!port) c.errors.push('SMTP_PORT is required when SMTP_HOST is set.');
  const tls = (c.text('SMTP_TLS') || 'true') as SmtpConfig['tls'];
  if (!TLS_MODES.includes(tls))
    c.errors.push(`SMTP_TLS: true, starttls or false, got "${tls}".`);
  const from = c.text('MAIL_FROM');
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(from))
    c.errors.push(
      'MAIL_FROM is required when SMTP_HOST is set: the sender address of the invitations.',
    );
  if (username && !password)
    c.errors.push('SMTP_USERNAME is set but SMTP_PASSWORD is empty.');
  return { host, port, tls, username, password, from };
}

export function loadConfig(
  env: Env,
  readFile: ReadFile,
): { config: Config } | { errors: string[] } {
  const c = new Collector(env, readFile);
  const url = publicUrl(c);
  const config: Config = {
    host: c.text('NOVA_HOST') || '127.0.0.1',
    port: c.number(NUMBERS.port),
    dataDir: c.text('NOVA_DATA_DIR') || './data',
    publicUrl: url,
    secureCookies: url.startsWith('https:'),
    trustProxy: c.flag('NOVA_TRUST_PROXY'),
    sessionDays: c.number(NUMBERS.sessionDays),
    inviteDays: c.number(NUMBERS.inviteDays),
    rateLimitAttempts: c.number(NUMBERS.rateLimitAttempts),
    rateLimitMinutes: c.number(NUMBERS.rateLimitMinutes),
    emailLoginCodes: c.flag('NOVA_EMAIL_LOGIN_CODES'),
    webPush: c.flag('NOVA_WEB_PUSH'),
    smtp: smtp(c),
  };
  if (config.emailLoginCodes && !config.smtp)
    c.errors.push(
      'NOVA_EMAIL_LOGIN_CODES requires SMTP_HOST and mail settings.',
    );
  if (config.webPush && !config.secureCookies)
    c.errors.push('NOVA_WEB_PUSH requires an HTTPS NOVA_PUBLIC_URL.');
  return c.errors.length ? { errors: c.errors } : { config };
}
