<script lang="ts">
  // The thin Runden-Rewind (#235, view G; okf/features/round-archive.md): a
  // story of full-width cards in the frame of the archive, from rewindPage()
  // of logic/round-rewind.ts. It is no view of its own but a panel in the
  // place of the list of RoundArchive, so „Optionen“ and the admin box
  // „Rundenberichte“ both show it. Buttons, the arrow keys and a swipe turn the
  // cards; the automatic play is off until asked for and has a pause. The
  // heading of the card gets the focus after the player turns it; a hidden
  // line with `aria-live` tells the stable result, not the count-up of an
  // animation (there is none). The `data-act`s are those of
  // features/round-archive.ts, the card remembers its place in
  // logic/round-rewind.svelte.ts because the page is mounted anew on every
  // render.
  import { tick } from 'svelte';
  import {
    AUTOPLAY_MS,
    keyStep,
    REWIND_WORDS,
    type RewindPage,
    stillMotion,
    swipeStep,
  } from '../logic/round-rewind.ts';
  import {
    rewindUi,
    togglePlay,
    turnRewind,
  } from '../logic/round-rewind.svelte.ts';

  let { page }: { page: RewindPage } = $props();
  const count = $derived(page.cards.length);
  const at = $derived(Math.min(rewindUi.index, count - 1));
  const card = $derived(page.cards[at]!);
  const last = $derived(at === count - 1);
  const still = stillMotion();
  let heading: HTMLElement | undefined = $state();
  let from: { x: number; y: number } | null = null;

  /** The player turns a card: the play pauses and the heading of the new card gets the focus. */
  async function go(step: number): Promise<void> {
    turnRewind(step, count);
    await tick();
    heading?.focus();
  }

  function key(e: KeyboardEvent): void {
    const step = keyStep(e.key);
    if (!step) return;
    e.preventDefault();
    void go(step);
  }

  function release(e: PointerEvent): void {
    if (!from) return;
    const step = swipeStep(e.clientX - from.x, e.clientY - from.y);
    from = null;
    if (step) void go(step);
  }

  // The automatic play: one card after the other, then it stops at the last.
  $effect(() => {
    if (!rewindUi.playing) return;
    const timer = setInterval(() => turnRewind(1, count, true), AUTOPLAY_MS);
    return () => clearInterval(timer);
  });

  const playLabel = $derived(
    rewindUi.playing
      ? REWIND_WORDS.pause
      : last && count > 1
        ? REWIND_WORDS.replay
        : REWIND_WORDS.play,
  );
  // While the play runs the focus stays where it is, so the card is told by the live line.
  const live = $derived(
    `Karte ${at + 1} von ${count}${rewindUi.playing ? `: ${card.headline} ${card.figure}` : ''}`,
  );
</script>

<p><button class="small" data-act="rewindBack">{REWIND_WORDS.back}</button></p>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="rw"
  class:still
  data-still={still ? 'true' : 'false'}
  aria-roledescription="Rewind"
  aria-labelledby="round-rewind-h"
  onkeydown={key}
>
  <h3 id="round-rewind-h">{page.heading}</h3>
  <ol class="rw-bar" aria-hidden="true">
    {#each page.cards as c, i (c.key)}
      <li class:on={i === at} class:done={i < at}></li>
    {/each}
  </ol>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="rw-card"
    data-card={card.key}
    onpointerdown={(e) => {
      if (e.pointerType !== 'mouse') from = { x: e.clientX, y: e.clientY };
    }}
    onpointerup={release}
    onpointercancel={() => (from = null)}
  >
    {#key at}
      <div class="rw-in">
        <p class="rw-kicker">{card.kicker}</p>
        <h4
          id="round-rewind-card-h"
          class="rw-head"
          tabindex="-1"
          bind:this={heading}
        >
          {card.headline}
        </h4>
        <p class="rw-figure">{card.figure}</p>
        {#each card.lines as line (line)}
          <p class="rw-line">{line}</p>
        {/each}
        {#if card.report !== null}
          <p>
            <button data-act="roundOpen" data-round={card.report}
              >{REWIND_WORDS.report}</button
            >
          </p>
        {/if}
      </div>
    {/key}
  </div>
  <p class="rw-live dim" aria-live="polite">{live}</p>
  <div class="flex rw-controls">
    <button
      type="button"
      data-rw="prev"
      disabled={at === 0}
      onclick={() => go(-1)}>{REWIND_WORDS.prev}</button
    >
    <button type="button" data-rw="next" disabled={last} onclick={() => go(1)}
      >{REWIND_WORDS.next}</button
    >
    {#if count > 1}
      <button type="button" data-rw="play" onclick={() => togglePlay(count)}
        >{playLabel}</button
      >
    {/if}
    <span class="dim">Karte {at + 1} von {count}</span>
  </div>
</section>
