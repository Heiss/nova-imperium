<script lang="ts">
  // The members of a guild (#163): name and points, and for the own guild the
  // rank and what the own rank may do with the member (hand over the Leitung,
  // „Rang ändern“, „Entfernen“; features/guilds.ts). The class `rank-select`
  // keeps a long rank name from widening the page (#277, style.css). The rank
  // chosen is the state of logic/guild-form.svelte.ts (#332).
  import { isChosen } from '../logic/form-state.svelte.ts';
  import { guildForm } from '../logic/guild-form.svelte.ts';
  import type { GuildPage } from '../logic/guilds.ts';

  let { roster }: { roster: GuildPage['roster'] } = $props();
</script>

<table class="guild-members">
  <tbody>
    <tr>
      <th>Spieler</th>
      {#if roster.ranked}<th>Rang</th>{/if}
      <th class="n">Punkte</th>
      {#if roster.ranked}<th></th>{/if}
    </tr>
    {#each roster.rows as row (row.id)}
      <tr>
        <td>{row.name}</td>
        {#if row.rank !== null}<td class="rank">{row.rank}</td>{/if}
        <td class="n">{row.points}</td>
        {#if row.controls}
          {@const controls = row.controls}
          <td>
            {#if controls.transfer}
              <button
                class="small"
                data-act="guildMember"
                data-uid={row.id}
                data-transfer="1">Leitung übergeben</button
              >
            {/if}{#if controls.assign}
              {#if controls.transfer}{' '}{/if}
              <select
                id="rank_of_{row.id}"
                class="rank-select"
                aria-label="Neuer Rang für {row.name}"
                onchange={(e) =>
                  (guildForm.rankOf[row.id] = e.currentTarget.value)}
              >
                {#each controls.assign.options as option (option.id)}
                  <option
                    value={option.id}
                    selected={isChosen(guildForm.rankOf[row.id], {
                      value: option.id,
                      selected: option.selected,
                    })}>{option.name}</option
                  >
                {/each}
              </select>
              <button class="small" data-act="guildAssign" data-uid={row.id}
                >Rang ändern</button
              >
            {/if}{#if controls.remove}
              {#if controls.transfer || controls.assign}{' '}{/if}
              <button class="small red" data-act="guildMember" data-uid={row.id}
                >Entfernen</button
              >
            {/if}
          </td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>
