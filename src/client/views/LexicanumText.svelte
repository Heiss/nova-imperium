<script lang="ts">
  // Words and links of a text of the Lexicanum (#285, B7): a link opens its
  // article on the page, or in the side panel when the text is shown there.
  import type { Segment } from '../../core/lexicon/links.ts';
  import { articleHref } from '../logic/address.ts';

  let { parts, panel = false }: { parts: Segment[]; panel?: boolean } =
    $props();
</script>

{#each parts as part, i (i)}{#if 'link' in part}<a
      class="lx-a"
      href={articleHref(part.link)}
      data-act={panel ? 'lexPanel' : 'lex'}
      data-a={part.link}>{part.text}</a
    >{:else}{part.text}{/if}{/each}
