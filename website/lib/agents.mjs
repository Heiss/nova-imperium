// agents.md and llms.txt (okf/ops/website.md): a map of the site for
// agents, generated at build time from the title and description of every
// page, with a link to the raw Markdown of each page.
import { GITHUB, SITE, SITE_URL, pagePath, rawPath } from './pages.mjs';

/** The sections of the site in the order of the sidebar. */
const SECTIONS = [
  ['', 'Home'],
  ['getting-started', 'Getting started'],
  ['contributing', 'Contributing'],
  ['git-workflow', 'Git workflow'],
  ['ci', 'CI and checks'],
  ['automation', 'Automation'],
  ['operations', 'Operations'],
  ['decisions', 'Decisions (OKF bundle)'],
];

/** The repository path of a page of the docs collection. */
export function sourceOf(page) {
  return page.data.source ?? `website/${page.filePath}`;
}

const slugOf = (page) => (page.id === 'index' ? '' : page.id);

function sectionOf(slug) {
  const prefix = slug.split('/')[0];
  const section = SECTIONS.find(([key]) => key === prefix);
  if (!section)
    throw new Error(`The page "${slug}" has no section in agents.md.`);
  return section[0];
}

function line(page) {
  const slug = slugOf(page);
  const { title, description } = page.data;
  const text = description ? `: ${description}` : '';
  return `- [${title}](${SITE}${pagePath(slug)}) ([Markdown](${SITE}${rawPath(slug)}), source \`${sourceOf(page)}\`)${text}`;
}

/** The text of agents.md. */
export function agentsMarkdown(pages) {
  const bySection = new Map(SECTIONS.map(([key]) => [key, []]));
  for (const page of pages) bySection.get(sectionOf(slugOf(page))).push(page);
  const out = [
    '# Nova Imperium documentation: map for agents',
    '',
    `> Generated at build time from the title and description of every page of ${SITE_URL}. Every page is also published as raw Markdown: the page URL with \`.md\` instead of the trailing slash (\`index.md\` for the home page). Links inside the raw Markdown point to raw Markdown too.`,
    '',
    `- Repository: ${GITHUB} (the sources: \`okf/\` for the decisions, \`docs/\` for operators and developers, \`website/\` for the guide pages)`,
    `- Start with the decisions index (${SITE}${rawPath('decisions')}) and the overview with the legend of the markers (${SITE}${rawPath('decisions/overview')}): **[E]** decision of the owner, **[V]** proposal, **[U]** unverified.`,
    '- Where a guide page and a decision disagree, the decision in `okf/` and the workflow files in `.github/workflows/` are the source of truth.',
  ];
  for (const [key, label] of SECTIONS) {
    const list = bySection
      .get(key)
      .sort(
        (a, b) =>
          (slugOf(a) === key ? -1 : 0) - (slugOf(b) === key ? -1 : 0) ||
          slugOf(a).localeCompare(slugOf(b)),
      );
    if (list.length) out.push('', `## ${label}`, '', ...list.map(line));
  }
  return `${out.join('\n')}\n`;
}

/** The text of llms.txt (llmstxt.org). */
export function llmsTxt() {
  return [
    '# Nova Imperium',
    '',
    '> A classic space strategy browser game for a group of friends – Node.js, SQLite, Svelte, self-hosted with Docker.',
    '',
    'The documentation explains how to run the game, how to contribute, the Git workflow, the checks of the CI, the automation of releases and every decision of the project.',
    '',
    '## Docs',
    '',
    `- [agents.md](${SITE}${rawPath('agents')}): map of the whole site with a short description of every page and a link to its raw Markdown`,
    '',
    '## Optional',
    '',
    `- [Repository](${GITHUB}): the source, with \`AGENTS.md\` for agents that work on the code`,
    '',
  ].join('\n');
}
