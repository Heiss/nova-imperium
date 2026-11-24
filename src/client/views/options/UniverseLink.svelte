<script lang="ts">
  // „Optionen“, the link „Dieses Universum“ (views/options/universe.ts).
  import type { BoxProps } from './contract.ts';
  import type { UniversePart } from '../../logic/options/universe.ts';

  let { page, section }: BoxProps<UniversePart> = $props();
</script>

<p data-sec={section}>
  Tempo, Größe und alle Einstellungen dieser Runde stehen im Lexicanum:
  <a
    class="lx-a"
    href={page.universe.href}
    data-act="lex"
    data-a={page.universe.article}>Dieses Universum</a
  >.
</p>
