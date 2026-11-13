// Import rules between the parts of the game (dependency-cruiser).
// The rules of the game live once in src/core; the server and the browser
// both use them, never each other (okf/architecture/system.md). The entries
// and missions live in src/features, one folder each; the core reaches them
// only through the generated index src/features/index.gen.ts
// (okf/architecture/patterns.md, sections 10 and 11; #112).
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
      name: 'core-stays-pure',
      severity: 'error',
      comment: 'src/core is used by the server and the browser alike.',
      from: { path: '^src/core/' },
      to: { path: '^src/(server|client)/' },
    },
    {
      name: 'feature-not-feature',
      severity: 'error',
      comment:
        'A feature (src/features/<key>/, src/features/missions/<m>/) may import the core, never another feature or the index of all features.',
      from: { path: '^src/features/(missions/[^/]+|[^/]+)/' },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'core-sees-features-through-index',
      severity: 'error',
      comment:
        'The core sees the features only through the generated index (scripts/gen-features.ts).',
      from: { path: '^src/core/' },
      to: {
        path: '^src/features/',
        pathNot: '^src/features/index\\.gen\\.ts$',
      },
    },
    {
      name: 'feature-stays-pure',
      severity: 'error',
      comment:
        'The core imports the features through the index, so they run in the browser too; only the *.server.ts parts may use the server.',
      from: {
        path: '^src/features/',
        pathNot: '\\.server\\.ts$|\\.test\\.ts$',
      },
      to: { path: '^src/(server|client)/' },
    },
    {
      name: 'server-parts-on-server',
      severity: 'error',
      comment:
        'A *.server.ts part is imported only by the server, by other *.server.ts parts and by tests.',
      from: { pathNot: '^src/server/|\\.server\\.ts$|\\.test\\.ts$' },
      to: { path: '\\.server\\.ts$' },
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
      comment: 'The server and the *.server.ts parts do not run browser code.',
      from: { path: '^src/server/|\\.server\\.ts$' },
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
        path: '^src/(server|core|features)/',
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
