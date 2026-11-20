<script lang="ts">
  // „Freunde“ (#118, bundle 7; #227, okf/features/buddy-list.md;
  // okf/architecture/patterns.md, section 9), from friendsPage() of
  // logic/friends.ts: the friends with their contact and status, the open
  // requests both ways and the form „Freundschaft anfragen“. The buttons
  // carry data-act="friend" with the action in `data-op` and the player in
  // `data-uid`, the form its id (features/social.ts). The class `friends`
  // is the one the phone layout of style.css reads.
  import { drafts, FRIEND_NAME } from '../logic/drafts.svelte.ts';
  import type { FriendsPage } from '../logic/friends.ts';
  import Box from './Box.svelte';
  import HomeCell from './HomeCell.svelte';

  let { page }: { page: FriendsPage } = $props();
</script>

<h2>Freunde</h2>
<div class="box">
  {#if page.rows.length}
    <table class="friends">
      <tbody>
        <tr>
          <th>Spieler</th><th>Gilde</th><th>Heimatplanet</th><th>Status</th><th
          ></th>
        </tr>
        {#each page.rows as friend (friend.id)}
          <tr>
            <td>{friend.name}</td><td>{friend.tag}</td><td
              ><HomeCell home={friend.home} /></td
            ><td
              >{#if friend.online}<span class="good">online</span>{:else}<span
                  class="dim">offline</span
                >{/if}</td
            ><td
              ><button
                class="small red"
                data-act="friend"
                data-op="remove"
                data-uid={friend.id}>Freundschaft beenden</button
              ></td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p>Du hast noch keine Freunde.</p>
  {/if}
</div>
<Box title="Anfragen">
  {#each page.incoming as player (player.id)}
    <p>
      {player.name}
      <button
        class="small"
        data-act="friend"
        data-op="accept"
        data-uid={player.id}>Annehmen</button
      >
      <button
        class="small"
        data-act="friend"
        data-op="refuse"
        data-uid={player.id}>Ablehnen</button
      >
    </p>
  {:else}
    <p>Keine offenen Anfragen.</p>
  {/each}
</Box>
{#if page.outgoing.length}
  <Box title="Deine Anfragen">
    {#each page.outgoing as player (player.id)}
      <p>
        {player.name}
        <button
          class="small"
          data-act="friend"
          data-op="cancel"
          data-uid={player.id}>Anfrage zurückziehen</button
        >
      </p>
    {/each}
  </Box>
{/if}
<Box title="Freundschaft anfragen">
  <form id="friendform" class="flex">
    <label for="friend_name">Name</label>
    <input
      id="friend_name"
      maxlength="20"
      required
      autocomplete="off"
      value={drafts.get(FRIEND_NAME)}
      oninput={(e) => drafts.set(FRIEND_NAME, e.currentTarget.value)}
    />
    <button type="submit">Freundschaft anfragen</button>
  </form>
</Box>
