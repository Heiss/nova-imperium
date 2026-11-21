<script lang="ts">
  // The dialog „Endzeit einläuten“ (#161, #214; #118, bundle 7), shown in the
  // modal, from endzeitDialogPage() of logic/admin.ts. features/admin.ts reads
  // `#endzeit-minutes` and handles `doEndzeit`; `closeModal` closes it.
  import type { EndzeitDialogPage } from '../logic/admin.ts';

  let { page }: { page: EndzeitDialogPage } = $props();
</script>

<p>
  <b>Endzeit einläuten – alle Spieler erhalten die Gabe des Gottkaisers.</b><br
  />
  Jeder Spieler mit Heimatplanet bekommt eine Verlegung zu seinem Heimatplaneten:
  je {page.ships} Schiffe jedes flugfähigen Typs und je {page.resources} Adamant,
  Psikristall und Promethium. Bei der Ankunft werden Forschung und Gebäude des Heimatplaneten
  so weit ausgebaut, dass alles freigeschaltet ist. Das geht nur einmal pro Runde.
</p>
<p>
  <label for="endzeit-minutes">Flugzeit der Gabe (Minuten)</label>
  <input
    type="number"
    id="endzeit-minutes"
    min={page.min}
    max={page.max}
    step="1"
    value={page.minutes}
    required
  />
  <span class="dim">{page.range}</span>
</p>
<p>
  <button class="red" data-act="doEndzeit">Ja, Endzeit einläuten</button>
  <button data-act="closeModal">Abbrechen</button>
</p>
