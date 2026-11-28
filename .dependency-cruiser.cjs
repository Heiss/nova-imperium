// Import rules between the parts of the game (dependency-cruiser).
// The rules of the game live once in src/core; the server and the browser
// both use them, never each other (okf/architecture/system.md). The entries
// and missions live in src/features, one folder each; the core reaches them
// only through the generated index src/features/index.gen.ts
// (okf/architecture/patterns.md, sections 10 and 11; #112). The arrivals of
// the missions (*.server.ts) are listed in src/features/index.server.gen.ts,
// which only the server imports (owner, 2026-11-14, #116).
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
        'The core sees the features only through the generated indexes (scripts/gen-features.ts): all features, and the lexicon parts (#285).',
      from: { path: '^src/core/' },
      to: {
        path: '^src/features/',
        pathNot: '^src/features/(index|lexicon)\\.gen\\.ts$',
      },
    },
    {
      name: 'lexicon-index-in-lexicon',
      severity: 'error',
      comment:
        'Only the Lexicanum (src/core/lexicon/) imports the index of the lexicon parts, so they load with its own chunk and not with the start bundle (#285, #242).',
      from: { pathNot: '^src/core/lexicon/' },
      to: { path: '^src/features/lexicon\\.gen\\.ts$' },
    },
    {
      name: 'guild-rights-list-in-guild-ranks',
      severity: 'error',
      comment:
        'Only src/core/guild-ranks.ts and its tests import the generated list of the guild rights (#426): every other module reads the rights from guild-ranks.ts.',
      from: {
        pathNot: [
          '^src/core/guild-ranks\\.ts$',
          '^src/core/guild-ranks\\.[a-z.-]*test\\.ts$',
        ],
      },
      to: { path: '^src/core/guild-rights/rights\\.gen\\.ts$' },
    },
    {
      name: 'chat-events-list-in-guild-chat',
      severity: 'error',
      comment:
        'Only src/core/guild-chat.ts and its tests import the generated list of the chat events (#426): every other module reads the events from guild-chat.ts.',
      from: {
        pathNot: [
          '^src/core/guild-chat\\.ts$',
          '^src/core/guild-chat\\.[a-z.-]*test\\.ts$',
        ],
      },
      to: { path: '^src/core/chat-events/events\\.gen\\.ts$' },
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
        'A *.server.ts part is imported only by the server, by other *.server.ts parts, by the server index and by tests.',
      from: {
        pathNot:
          '^src/server/|\\.server\\.ts$|\\.test\\.ts$|^src/features/index\\.server\\.gen\\.ts$',
      },
      to: { path: '\\.server\\.ts$' },
    },
    {
      name: 'server-index-on-server',
      severity: 'error',
      comment:
        'The index of the server parts of the missions (MISSION_SERVERS) is imported only by src/server.',
      from: { pathNot: '^src/server/' },
      to: { path: '^src/features/index\\.server\\.gen\\.ts$' },
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
