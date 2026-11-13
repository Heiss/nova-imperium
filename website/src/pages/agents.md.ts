// agents.md: the map of the site for agents, generated from the title and
// description of every page, served raw (okf/ops/website.md).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { agentsMarkdown } from '../../lib/agents.mjs';

export const GET: APIRoute = async () =>
  new Response(agentsMarkdown(await getCollection('docs')), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
