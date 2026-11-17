<script lang="ts">
  // The fleet view (#118, bundle 3; okf/architecture/patterns.md,
  // section 9): from fleetPage() of logic/fleet.ts. Its buttons and links
  // carry data-act, which main.ts handles; main.ts also reads the form and
  // writes the target and the preview of the flight into its cells while
  // the player types. The list „Auftrag“ shows `page.missions`, every
  // mission, until main.ts aims the form at its target (aimFleet() of
  // fleet.ts): then only the missions that fit it (#253), or „Ziel wird
  // geprüft …“ and no sending while the target is not known. Without a
  // mission that fits (the start planet as target) nothing is sent either.
  // The „Schnellwahl“ enters an own planet or moon as the target.
  import type { FleetPage, MissionChoice } from '../logic/fleet.ts';
  import FleetMoves from './FleetMoves.svelte';

  let { page, choice }: { page: FleetPage; choice?: MissionChoice } = $props();
  /** The choice for the target the player typed. */
  let aimed = $state<MissionChoice>();
  const missions = $derived((aimed ?? choice)?.options ?? page.missions);
  const checking = $derived(!!(aimed ?? choice)?.checking);
  /** No mission to send: the target is being checked, or none fits it. */
  const blocked = $derived(checking || !missions.length);

  /**
   * The „Schnellwahl“: a chosen place is entered into the fields of the
   * target, and the list goes back to „– wählen –“. The listener is on the
   * list itself, so it runs before the one of main.ts on the document,
   * which then updates the target, the missions and the preview.
   */
  function quick(select: HTMLSelectElement) {
    const enter = (): void => {
      const place = page.quick.find((q) => q.value === select.value);
      if (!place) return;
      for (const [id, value] of Object.entries(place.fields))
        (document.getElementById(id) as HTMLInputElement).value = value;
      select.value = '';
    };
    select.addEventListener('change', enter);
    return { destroy: () => select.removeEventListener('change', enter) };
  }

  /** Shows the missions of this choice in the list „Auftrag“. */
  export function aim(next: MissionChoice): void {
    aimed = next;
  }
</script>

<h2>Flotte</h2>
<div class="box">
  <div class="hd">Flotten unterwegs ({page.slots} Slots)</div>
  <div class="bd"><FleetMoves fleets={page.fleets} /></div>
</div>
{#if page.ships.length}
  <div class="box">
    <div class="hd">1. Schiffe auswählen</div>
    <div class="bd">
      <table>
        <tbody>
          <tr
            ><th>Schiff</th><th class="n">vorhanden</th><th class="n">Tempo</th
            ><th>Anzahl</th></tr
          >
          {#each page.ships as ship (ship.key)}
            <tr>
              <td>{ship.name}</td>
              <td class="n">{ship.have}</td>
              <td class="n">{ship.speed}</td>
              <td
                ><input
                  type="number"
                  min="0"
                  class="fs"
                  id="f_{ship.key}"
                  data-k={ship.key}
                  placeholder="0"
                  aria-label="Anzahl {ship.name}"
                />
                <span class="lnk" data-act="fmax" data-k={ship.key}>max</span
                ></td
              >
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="mt">
        <span class="lnk" data-act="fall">alle Schiffe</span> ·
        <span class="lnk" data-act="fnone">keine Schiffe</span>
      </div>
    </div>
  </div>
  <div class="box">
    <div class="hd">2. Ziel und Auftrag</div>
    <div class="bd">
      <table class="kv">
        <tbody>
          <tr>
            <td>Ziel</td>
            <td
              ><input
                class="c3"
                type="number"
                id="t_g"
                value={page.target.g}
                min="1"
                max={page.target.galaxies}
                aria-label="Galaxie"
              />:<input
                class="c3"
                type="number"
                id="t_s"
                value={page.target.s}
                min="1"
                max={page.target.systems}
                aria-label="System"
              />:<input
                class="c3"
                type="number"
                id="t_p"
                value={page.target.p}
                min="1"
                max={page.target.positions}
                aria-label="Position"
              />
              <select id="t_k" aria-label="Zielart"
                ><option value="planet">Planet</option><option
                  value="moon"
                  disabled={!page.target.moon}
                  selected={page.target.toMoon}>Mond</option
                ></select
              >
              <span id="t_info" class="dim"></span></td
            >
          </tr>
          {#if page.quick.length}
            <tr>
              <td>Schnellwahl</td>
              <td
                ><select id="t_q" aria-label="Schnellwahl" use:quick
                  ><option value="">– wählen –</option
                  >{#each page.quick as place (place.value)}<option
                      value={place.value}>{place.label}</option
                    >{/each}</select
                ></td
              >
            </tr>
          {/if}
          <tr>
            <td>Auftrag</td>
            <td
              ><select id="t_m" aria-label="Auftrag"
                >{#if checking}<option value="">Ziel wird geprüft …</option
                  >{:else}{#each missions as mission (mission.value)}<option
                      value={mission.value}
                      selected={mission.selected}>{mission.label}</option
                    >{/each}{/if}</select
              ></td
            >
          </tr>
          <tr>
            <td>Geschwindigkeit</td>
            <td
              ><select id="t_v" aria-label="Geschwindigkeit"
                >{#each page.speeds as speed (speed.value)}<option
                    value={speed.value}>{speed.label}</option
                  >{/each}</select
              ></td
            >
          </tr>
          <tr>
            <td>Ladung (Adamant / Psikristall / Promethium)</td>
            <td
              >{#each page.cargo as field, i (field.key)}{#if i}{' '}{/if}<span
                  class="cargo"
                  ><input
                    type="number"
                    id="c_{field.key}"
                    min="0"
                    placeholder="0"
                    aria-label={field.name}
                  /><button
                    type="button"
                    id="cone_{field.key}"
                    class="small"
                    data-act="cone"
                    data-k={field.key}
                    aria-label="Alles {field.name}">alles</button
                  ></span
                >{/each}
              <span class="lnk" data-act="cmax">alles (gleichmäßig)</span></td
            >
          </tr>
          <tr><td>Entfernung</td><td id="i_dist">-</td></tr>
          <tr><td>Flugdauer (eine Richtung)</td><td id="i_dur">-</td></tr>
          <tr><td>Ankunft / Rückkehr</td><td id="i_arr">-</td></tr>
          <tr><td>Treibstoff</td><td id="i_fuel">-</td></tr>
          <tr><td>Laderaum</td><td id="i_cap">-</td></tr>
        </tbody>
      </table>
      <div class="mt10">
        <button data-act="send" disabled={page.full || blocked}
          >Flotte losschicken</button
        >
        {#if page.full}<span class="bad"
            >Alle Flottenslots belegt (Kogitator-Doktrin erhöht die Anzahl).</span
          >{/if}
      </div>
    </div>
  </div>
{:else}
  <div class="notice">
    Auf diesem Planeten stehen keine Schiffe. Baue welche in der
    Schiffsschmiede.
  </div>
{/if}
