<script lang="ts">
  // The dialog „Neue Runde“ (#283; #118, bundle 7), shown in the modal, from
  // roundDialogPage() of logic/admin.ts: one field per setting of the
  // registry, the members of a group with a legend in one fieldset.
  // features/round.ts reads the fields by their ids (`round-…`), hides and
  // shows the wrapper `[data-round-field]` of a conditional field and writes
  // the preview line `#round-preview-…` again whenever a field changes; the
  // buttons are `doReset` and `closeModal`.
  import type { RoundDialogPage, RoundField } from '../logic/admin.ts';

  let { page }: { page: RoundDialogPage } = $props();
</script>

{#snippet field(f: RoundField)}
  {#if f.kind === 'switch'}
    <label
      ><input
        type="checkbox"
        id={f.id}
        aria-describedby={f.note ? `${f.id}-note` : undefined}
        checked={f.checked}
      />
      {f.label}</label
    >
  {:else if f.kind === 'choice'}
    <label for={f.id}>{f.label}</label>
    <select id={f.id}>
      {#each f.choices as choice (choice.value)}
        <option value={choice.value} selected={choice.selected}
          >{choice.label}</option
        >
      {/each}
    </select>
  {:else}
    <label for={f.id}>{f.label}</label>
    <input
      type="number"
      id={f.id}
      min={f.min}
      max={f.max}
      step="1"
      value={f.value}
      required
    />
    <span class="dim">{f.min} bis {f.max}</span>
  {/if}
{/snippet}

<p>
  <b>Wirklich eine neue Runde starten?</b><br />
  Die laufende Runde wird vorher im Rundenarchiv gespeichert. Planeten, Flotten, Forschung,
  Nachrichten und Belohnungsfortschritt werden zurückgesetzt. Das kann nicht rückgängig
  gemacht werden.
</p>
{#each page.rows as row, i (i)}
  {#if row.kind === 'field'}
    <p>
      {@render field(
        row.field,
      )}{#if row.field.kind === 'switch' && row.field.note}<br /><span
          id="{row.field.id}-note">{row.field.note}</span
        >{/if}
    </p>
  {:else}
    <fieldset>
      <legend>{row.legend}</legend>
      {#each row.members as member (member.field.id)}
        {#if member.wrap}
          <span data-round-field={member.wrap.id} hidden={member.wrap.hidden}
            >{#if member.lead}<br />{/if}{@render field(member.field)}</span
          >
        {:else}
          {#if member.lead}<br />{/if}{@render field(member.field)}
        {/if}
      {/each}
      {#if row.preview}
        <p class="dim" id="round-preview-{row.preview.name}" aria-live="polite">
          {row.preview.text}
        </p>
      {/if}
    </fieldset>
  {/if}
{/each}
{#each page.rows as row, i (i)}
  {#if row.kind === 'group' && row.confirm}
    <p id="round-confirm-{row.confirm.name}" aria-live="polite">
      {row.confirm.text}
    </p>
  {/if}
{/each}
<p>
  <button class="red" data-act="doReset">Ja, neue Runde</button>
  <button data-act="closeModal">Abbrechen</button>
</p>
