// llms.txt (llmstxt.org) points agents to agents.md (okf/ops/website.md).
import type { APIRoute } from 'astro';
import { llmsTxt } from '../../lib/agents.mjs';

export const GET: APIRoute = () =>
  new Response(llmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
