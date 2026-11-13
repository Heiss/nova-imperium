import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // The repository path of a page copied from okf/ or docs/
      // (scripts/sync-content.mjs); hand-written pages have none.
      extend: z.object({ source: z.string().optional() }),
    }),
  }),
};
