// Sending the invitation mails through SMTP (nodemailer). Without SMTP the
// admin copies the link from the admin panel.
import nodemailer from 'nodemailer';
import type { SmtpConfig } from './config.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export type Mailer = (mail: Mail) => Promise<void>;

export function transportOptions(smtp: SmtpConfig): Record<string, unknown> {
  return {
    host: smtp.host,
    port: smtp.port,
    // true: TLS from the start (port 465); starttls: STARTTLS is required (587);
    // false: no encryption, only for a local mail sink.
    secure: smtp.tls === 'true',
    requireTLS: smtp.tls === 'starttls',
    ignoreTLS: smtp.tls === 'false',
    auth: smtp.username
      ? { user: smtp.username, pass: smtp.password }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };
}

export function createMailer(
  smtp: SmtpConfig,
  create: (o: Record<string, unknown>) => {
    sendMail: (m: object) => Promise<unknown>;
  } = (o) => nodemailer.createTransport(o),
): Mailer {
  const transport = create(transportOptions(smtp));
  return async (mail) => {
    await transport.sendMail({
      from: smtp.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
  };
}

export function invitationMail(
  to: string,
  link: string,
  expires: number,
  inviter: string,
): Mail {
  const until = new Date(expires).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return {
    to,
    subject: 'Einladung zu Nova Imperium',
    text: [
      `Hallo,`,
      ``,
      `${inviter} lädt dich zu Nova Imperium ein, einem Weltraum-Strategiespiel im Browser.`,
      ``,
      `Mit diesem Link legst du dein Konto an:`,
      link,
      ``,
      `Der Link gilt einmal und bis ${until} Uhr. Wenn du die Einladung nicht erwartet hast, ignoriere diese Mail einfach.`,
    ].join('\n'),
  };
}
