// The mail sink of the E2E suite (#68): an SMTP server on 127.0.0.1 that
// appends every mail it receives as a JSON line to a file, and the reader the
// tests use to find a link or a code in those mails.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { SMTPServer } from 'smtp-server';

interface Stored {
  to: string[];
  raw: string;
}

export function startMailSink(port: number, file: string): Promise<void> {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,
    onData(stream, session, done) {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const mail: Stored = {
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks).toString('utf8'),
        };
        appendFileSync(file, `${JSON.stringify(mail)}\n`);
        done();
      });
    },
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

/** The text of a mail: quoted-printable or base64 as nodemailer sends it. */
function bodyOf(raw: string): string {
  const split = raw.indexOf('\r\n\r\n');
  const head = raw.slice(0, split);
  const body = raw.slice(split + 4);
  const encoding = /^content-transfer-encoding:\s*(\S+)/im.exec(head)?.[1];
  if (encoding?.toLowerCase() === 'base64')
    return Buffer.from(body, 'base64').toString('utf8');
  if (encoding?.toLowerCase() !== 'quoted-printable') return body;
  const bytes = body
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  return Buffer.from(bytes, 'latin1').toString('utf8');
}

/** The texts of the mails to `to` that the sink in `file` received, oldest first. */
export function mailsTo(file: string, to: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Stored)
    .filter((mail) => mail.to.includes(to))
    .map((mail) => bodyOf(mail.raw));
}
