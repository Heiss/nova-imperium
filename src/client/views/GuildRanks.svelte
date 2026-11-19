<script lang="ts">
  // The ranks of the own guild (#163, #277): each rank with its editor for a
  // rank below the own one, else its rights as text. The buttons carry
  // data-act (features/guilds.ts), which reads the fields by their ids and the
  // checkboxes by `data-rank-right`; main.ts keeps a ticked box over a refresh.
  import { MAX_RANK_NAME, MIN_RANK_NAME } from '../../core/guild-ranks.ts';
  import type { GuildPage } from '../logic/guilds.ts';
  import Box from './Box.svelte';

  type Ranks = NonNullable<GuildPage['management']>['ranks'];

  let { ranks }: { ranks: Ranks } = $props();
</script>

<Box title="Ränge">
  {#each ranks.entries as rank (rank.id)}
    <fieldset class="rank">
      <legend>{rank.legend}</legend>
      {#if rank.editor}
        {@const editor = rank.editor}
        <div>
          <label for="rank_name_{rank.id}">Rangname</label>
          <input
            id="rank_name_{rank.id}"
            required
            minlength={MIN_RANK_NAME}
            maxlength={MAX_RANK_NAME}
            value={editor.name}
          />
          <button class="small" data-act="rankRename" data-rank={rank.id}
            >Umbenennen</button
          >
        </div>
        <div class="rights">
          {#each editor.boxes as box (box.right)}
            <label class="switch"
              ><input
                type="checkbox"
                id="rank_{rank.id}_{box.right}"
                data-rank-right={rank.id}
                value={box.right}
                checked={box.checked}
                disabled={box.disabled}
              />
              {box.label}</label
            >
          {/each}
        </div>
        <p>
          <button class="small" data-act="rankRights" data-rank={rank.id}
            >Rechte speichern</button
          >
          {#if editor.up}
            <button
              class="small"
              data-act="rankMove"
              data-rank={rank.id}
              data-up="1">Nach oben</button
            >
          {/if}
          {#if editor.down}
            <button class="small" data-act="rankMove" data-rank={rank.id}
              >Nach unten</button
            >
          {/if}
          {#if editor.remove}
            <button class="small red" data-act="rankDelete" data-rank={rank.id}
              >Löschen</button
            >
          {/if}
        </p>
      {:else if rank.rights === 'all'}
        <p>Alle Rechte.</p>
      {:else if rank.rights === 'none'}
        <p>Keine Rechte.</p>
      {:else}
        <ul>
          {#each rank.rights as text (text)}<li>{text}</li>{/each}
        </ul>
      {/if}
      {#if rank.makeDefault}
        <p>
          <button class="small" data-act="rankDefault" data-rank={rank.id}
            >Als Standardrang</button
          >
        </p>
      {/if}
    </fieldset>
  {/each}
  {#if ranks.create}
    <div>
      <label for="rank_new">Name des neuen Rangs</label>
      <input
        id="rank_new"
        minlength={MIN_RANK_NAME}
        maxlength={MAX_RANK_NAME}
      />
      <button data-act="rankCreate">Rang anlegen</button>
    </div>
  {/if}
</Box>
