<script lang="ts">
  // „Gilden“ (#118, bundle 6; okf/architecture/patterns.md, section 9), from
  // guildsPage() of logic/guilds.ts: the directory with the form to found a
  // guild, or the page of one guild with its members, its chat and, for the
  // own guild, the applications, the ranks and the profile (#163, #169, #277).
  // The buttons carry data-act and the forms their ids (features/guilds.ts,
  // features/social.ts). The classes `guild-title`, `guild-list`,
  // `guild-members` and `rank-select` are the ones style.css wraps long names by
  // (#274), so a guild with the longest tag and name keeps a phone in width.
  import type { GuildsPage } from '../logic/guilds.ts';
  import Box from './Box.svelte';
  import GuildChat from './GuildChat.svelte';
  import GuildMembers from './GuildMembers.svelte';
  import GuildProfileForm from './GuildProfileForm.svelte';
  import GuildRanks from './GuildRanks.svelte';

  let { page }: { page: GuildsPage } = $props();
</script>

{#if page.kind === 'directory'}
  <h2>Gilden</h2>
  <Box title="Gildenübersicht">
    {#if page.rows.length}
      <table class="guild-list">
        <tbody>
          <tr>
            <th>Gilde</th><th class="n">Mitglieder</th>{#if page.points}<th
                class="n">Punkte</th
              ><th class="n">Ø Punkte</th>{/if}
          </tr>
          {#each page.rows as row (row.id)}
            <tr>
              <td
                ><a href={row.href} data-act="guildView" data-id={row.id}
                  >{row.heading}</a
                ></td
              >
              <td class="n">{row.members}</td>{#if page.points}<td class="n"
                  >{row.score}</td
                ><td class="n">{row.average}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p>Es gibt noch keine Gilden.</p>
    {/if}
  </Box>
  {#if page.create}
    <Box title="Neue Gilde"><GuildProfileForm form={page.create} /></Box>
  {/if}
{:else}
  <h2 class="guild-title">{page.heading}</h2>
  <p>
    <button class="small" data-act="nav" data-v="guilds"
      >Zur Gildenübersicht</button
    >
  </p>
  <Box title="Gildenprofil">
    {#if page.profileHtml}
      <!-- The one {@html} with data of a player that stays (owner, 2026-11-21,
      #337 Q41): the guild description as the server renders it with
      markdown-it (html: false, linkify: false, images disabled,
      src/server/game/guilds.ts), so a tag typed by a player comes out as text. -->
      {@html page.profileHtml}
    {:else}
      <p>Diese Gilde hat noch keinen Profiltext.</p>
    {/if}
  </Box>
  {#if page.score !== null}
    <Box title="Punkte">
      <p>{page.score} gesamt · {page.average} pro Mitglied</p>
    </Box>
  {/if}
  <Box title="Mitglieder"><GuildMembers roster={page.roster} /></Box>
  {#if page.chat}<GuildChat chat={page.chat} />{/if}
  {#if page.membership.kind === 'apply'}
    <button data-act="guildApply" data-id={page.membership.id}>Bewerben</button>
  {:else if page.membership.kind === 'pending'}
    <p>Deine Bewerbung ist offen.</p>
    <button data-act="guildLeave">Bewerbung zurückziehen</button>
  {:else if page.membership.kind === 'leave'}
    <button data-act="guildLeave" data-confirm="Gilde wirklich verlassen?"
      >Gilde verlassen</button
    >
  {:else if page.membership.kind === 'dissolve'}
    <button class="red" data-act="guildDissolve" data-id={page.membership.id}
      >Gilde auflösen</button
    >
  {/if}
  {#if page.adminChat}
    <p>
      <button class="small" data-act="guildChatAdmin" data-id={page.id}
        >Chat lesen</button
      >
    </p>
  {/if}
  {#if page.management}
    {@const management = page.management}
    {#if management.applications}
      <Box title="Bewerbungen">
        {#each management.applications as applicant (applicant.id)}
          <p>
            {applicant.name}
            <button
              class="small"
              data-act="guildReview"
              data-uid={applicant.id}
              data-accept="1">Annehmen</button
            >
            <button class="small" data-act="guildReview" data-uid={applicant.id}
              >Ablehnen</button
            >
          </p>
        {:else}
          <p>Keine offenen Bewerbungen.</p>
        {/each}
      </Box>
    {/if}
    <GuildRanks ranks={management.ranks} />
    {#if management.profile}
      <Box title="Gildenprofil bearbeiten">
        <GuildProfileForm form={management.profile} />
      </Box>
    {/if}
  {/if}
{/if}
