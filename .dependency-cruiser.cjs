// Import rules between the parts of the game (dependency-cruiser).
// The rules of the game live once in src/shared; the server and the browser
// both use them, never each other (okf/architecture/system.md).
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular imports make the order of initialisation fragile. Type-only imports do not run, so they do not count.',
      from: {},
      to: {
        circular: true,
        viaOnly: { dependencyTypesNot: ['type-only'] },
      },
    },
    {
      name: 'shared-stays-pure',
      severity: 'error',
      comment: 'src/shared is used by the server and the browser alike.',
      from: { path: '^src/shared/' },
      to: { path: '^src/(server|client)/' },
    },
    {
      name: 'client-not-server',
      severity: 'error',
      comment: 'The browser reaches the server only through the HTTP API.',
      from: { path: '^src/client/' },
      to: { path: '^src/server/' },
    },
    {
      name: 'server-not-client',
      severity: 'error',
      comment: 'The server does not run browser code.',
      from: { path: '^src/server/' },
      to: { path: '^src/client/' },
    },
    {
      name: 'tests-stay-out',
      severity: 'error',
      comment:
        'Production code does not import test helpers or the frozen version 1.',
      from: {
        path: '^src/',
        pathNot: '\\.test\\.ts$|^src/test/|^src/server/test-helpers\\.ts$',
      },
      to: { path: '^src/test/|\\.test\\.ts$|^src/server/test-helpers\\.ts$' },
    },
    {
      name: 'server-runtime-deps',
      severity: 'error',
      comment: 'The image installs production dependencies only (Dockerfile).',
      from: {
        path: '^src/(server|shared)/',
        pathNot: '\\.test\\.ts$|test-helpers\\.ts$',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    // Not followed, but imports into them stay visible to the rules.
    doNotFollow: { path: 'node_modules|^src/test/legacy/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
