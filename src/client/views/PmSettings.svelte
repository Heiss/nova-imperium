<script lang="ts">
  // The settings of the private messages (#226): the switch „only friends may
  // write to me“ and the block list. The server checks everything; the
  // component owns the name to block and the busy state.
  import { PM_LABELS, pmCall } from '../logic/private-messages.ts';

  let { friendsOnly, blocked }: { friendsOnly: boolean; blocked: string[] } =
    $props();

  let name = $state('');
  let busy = $state(false);

  async function block(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const ok = await pmCall(event.currentTarget as HTMLFormElement, [
      'blockPlayer',
      { name: name.trim() },
    ]);
    busy = false;
    if (ok) name = '';
  }
</script>

<div class="box" id="pm-settings">
  <div class="bd">
    <label class="switch"
      ><input
        id="pm-friends-only"
        type="checkbox"
        checked={friendsOnly}
        onchange={(e) =>
          pmCall(e.currentTarget, [
            'privateMessageOptions',
            { friendsOnly: e.currentTarget.checked },
          ])}
      />
      {PM_LABELS.friendsOnly}</label
    >
    <h3>{PM_LABELS.blocked}</h3>
    {#each blocked as who (who)}
      <p>
        {who}
        <button
          class="small"
          type="button"
          onclick={(e) =>
            pmCall(e.currentTarget, ['unblockPlayer', { name: who }])}
          >{PM_LABELS.unblock}</button
        >
      </p>
    {:else}
      <p class="dim">{PM_LABELS.noBlocked}</p>
    {/each}
    <form id="pm-block" class="flex" onsubmit={block}>
      <label for="pm-block-name">{PM_LABELS.recipient}</label>
      <input
        id="pm-block-name"
        maxlength="20"
        required
        autocomplete="off"
        value={name}
        oninput={(e) => (name = e.currentTarget.value)}
      />
      <button type="submit" disabled={busy}>{PM_LABELS.block}</button>
    </form>
  </div>
</div>
