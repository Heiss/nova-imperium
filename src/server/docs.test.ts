// The documentation follows the code: every setting is described with its
// default and range, `.env.example` and compose.yaml know it, the links of
// the docs and of the OKF bundle resolve.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NUMBERS, SECRETS, SETTINGS } from './config.ts';

const root = path.resolve(import.meta.dirname, '../..');
const read = (f: string): string => readFileSync(path.join(root, f), 'utf8');
const table = read('docs/configuration.md');
const example = read('.env.example');
const compose = read('compose.yaml');

const row = (name: string): string =>
  table.split('\n').find((l) => l.startsWith(`| \`${name}\``)) ?? '';

function markdownFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((f) => {
    const rel = path.join(dir, f);
    if (statSync(path.join(root, rel)).isDirectory()) return markdownFiles(rel);
    return f.endsWith('.md') ? [rel] : [];
  });
}

describe('documentation', () => {
  it('describes every setting of the server', () => {
    for (const name of SETTINGS) expect(row(name), name).not.toBe('');
  });

  it('names the defaults and ranges of the numbers', () => {
    for (const spec of Object.values(NUMBERS)) {
      const r = row(spec.name);
      expect(r).toContain(`\`${spec.def}\``);
      expect(r).toContain(`${spec.min} to ${spec.max}`);
    }
  });

  it('lists the settings in .env.example and passes them in compose.yaml', () => {
    const local = [
      'NOVA_HOST',
      'NOVA_PORT',
      'NOVA_DATA_DIR',
      'NOVA_TRUST_PROXY',
      'SMTP_PASSWORD',
    ];
    for (const name of SETTINGS) {
      if (local.includes(name)) continue;
      expect(example, name).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
      expect(compose, name).toContain(`${name}: \${${name}`);
    }
    expect(compose).toContain("NOVA_TRUST_PROXY: '1'");
    expect(compose).toContain('SMTP_PASSWORD_FILE: /run/secrets/smtp_password');
    expect(example).not.toMatch(/^SMTP_PASSWORD=/m);
    for (const s of SECRETS) expect(table).toContain(`\`${s}_FILE\``);
  });

  it('has links that resolve', () => {
    const files = [
      'README.md',
      ...markdownFiles('docs'),
      ...markdownFiles('okf'),
    ];
    for (const file of files) {
      const text = read(file);
      for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        const target = m[1]!;
        if (/^https?:/.test(target)) continue;
        const resolved =
          file.startsWith('okf') && target.startsWith('/')
            ? path.join(root, 'okf', target)
            : path.join(root, path.dirname(file), target);
        expect(existsSync(resolved), `${file} → ${target}`).toBe(true);
      }
    }
  });

  it('names files of the repository that exist', () => {
    const named =
      read('docs/development.md') +
      read('docs/getting-started.md') +
      read('docs/operations.md');
    for (const m of named.matchAll(/`((?:docker|src|e2e|okf)\/[\w./-]+)`/g))
      expect(existsSync(path.join(root, m[1]!)), m[1]).toBe(true);
  });
});
