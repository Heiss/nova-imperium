// Every page as raw Markdown at /nova-imperium/<slug>.md (index.md for the
// home page), linked from agents.md (okf/ops/website.md).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { rawMarkdown } from '../../lib/raw.mjs';
import { sourceOf } from '../../lib/agents.mjs';

export const getStaticPaths = (async () => {
  const pages = await getCollection('docs');
  return pages.map((page) => ({
    params: { slug: page.id === 'index' ? 'index' : page.id },
    props: { source: sourceOf(page) },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(rawMarkdown(props.source as string), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
