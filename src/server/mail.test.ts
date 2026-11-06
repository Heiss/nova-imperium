import { describe, expect, it } from 'vitest';
import type { SmtpConfig } from './config.ts';
import { createMailer, invitationMail, transportOptions } from './mail.ts';

const smtp: SmtpConfig = {
  host: 'mail.example.org',
  port: 465,
  tls: 'true',
  username: 'me',
  password: 'pw',
  from: 'game@example.org',
};

describe('mail', () => {
  it('maps the TLS modes to the transport', () => {
    expect(transportOptions(smtp)).toMatchObject({
      host: 'mail.example.org',
      port: 465,
      secure: true,
      requireTLS: false,
      ignoreTLS: false,
      auth: { user: 'me', pass: 'pw' },
    });
    expect(transportOptions({ ...smtp, tls: 'starttls' })).toMatchObject({
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
    });
    expect(
      transportOptions({ ...smtp, tls: 'false', username: '' }),
    ).toMatchObject({
      secure: false,
      requireTLS: false,
      ignoreTLS: true,
      auth: undefined,
    });
  });

  it('sends from the configured address', async () => {
    const sent: object[] = [];
    let options: Record<string, unknown> = {};
    const mailer = createMailer(smtp, (o) => {
      options = o;
      return { sendMail: async (m: object) => void sent.push(m) };
    });
    await mailer({ to: 'a@b.cd', subject: 'S', text: 'T' });
    expect(options.host).toBe('mail.example.org');
    expect(sent).toEqual([
      { from: 'game@example.org', to: 'a@b.cd', subject: 'S', text: 'T' },
    ]);
  });

  it('creates a real nodemailer transport by default', () => {
    expect(typeof createMailer({ ...smtp, tls: 'false' })).toBe('function');
  });

  it('writes the invitation in German with the link and the end date', () => {
    const m = invitationMail(
      'a@b.cd',
      'https://x.org/#invite=t',
      Date.UTC(2026, 10, 13, 11, 0),
      'Anna',
    );
    expect(m.to).toBe('a@b.cd');
    expect(m.subject).toBe('Einladung zu Nova Imperium');
    expect(m.text).toContain('Anna lädt dich zu Nova Imperium ein');
    expect(m.text).toContain('\nhttps://x.org/#invite=t\n');
    expect(m.text).toContain('bis 13.11.2026, 12:00 Uhr');
  });
});
