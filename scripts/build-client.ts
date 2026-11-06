// Builds the browser client into dist/public: one bundled, minified script
// plus the static files. Run with `pnpm build`.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist/public');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(root, 'src/client/static'), out, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/client/main.ts')],
  outfile: path.join(out, 'app.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'warning',
});
console.log(`Client built into ${path.relative(root, out)}`);
