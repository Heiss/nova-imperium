<script lang="ts">
  // The fleet view (#118, bundle 3; okf/architecture/patterns.md,
  // section 9), from fleetPage() of logic/fleet.ts. Its buttons and links
  // carry data-act, which main.ts handles; features/fleet.ts reads the form
  // and writes the preview of the flight into its places while the player
  // types. The ships, the position, the kind of target, the mission, the
  // union, the time at the target, the speed, the cargo, the „Zielmond“ of
  // the Warp-Tor and the names to invite are the state of logic/fleet-form.svelte.ts (#332): a field takes
  // `value` with `oninput` (a select `selected` with `onchange`), so a
  // half-typed number is never written over. What the lists and the row of the
  // time show for that state is worked out by logic/fleet-choice.ts.
  import { HOLD_HOURS } from '../../core/holding.ts';
  import { typedCargo } from '../../core/cargo-fill.ts';
  import { fleetForm } from '../logic/fleet-form.svelte.ts';
  import { hoursLabel } from '../logic/fleet-time.ts';
  import { QUICK_FIRST } from '../logic/fleet-target.ts';
  import { PLAN } from '../logic/union.ts';
  import { shown } from '../logic/galaxy-position.svelte.ts';
  import {
    CARGO_FIELDS,
    type FleetPage,
    PLAN_OPTION,
    SPEEDS,
    UNION_HINT,
  } from '../logic/fleet.ts';
  import Due from './Due.svelte';
  import FleetMoves from './FleetMoves.svelte';

  let { page }: { page: FleetPage } = $props();
  const form = $derived(page.form);
  const target = $derived(form.target);
  // What the fields show for the state of the form (logic/fleet-choice.ts).
  const choice = $derived(form.choose(fleetForm));
</script>

<h2>Flotte</h2>
<div class="box">
  <div class="hd">{page.heading}</div>
  <div class="bd"><FleetMoves fleets={page.fleets} /></div>
</div>
{#if page.unions}
  <div class="box">
    <div class="hd">Verbandsangriff</div>
    <div class="bd">
      {#each page.unions.unions as union (union.id)}
        <div class="union" id="un_{union.id}">
          <b>{union.title}</b> · Anführer {union.leader} · Ankunft in
          <Due due={union.due} />
          <div class="dim">{union.counts}</div>
          <div>Flotten: {union.fleets}</div>
          {#if union.invited}<div class="dim">
              Eingeladen: {union.invited}
            </div>{/if}
          {#if union.leads}<div class="mt">
              <input
                type="text"
                id="un_name_{union.id}"
                value={fleetForm.invite[union.id]}
                oninput={(e) =>
                  (fleetForm.invite[union.id] = e.currentTarget.value)}
                maxlength="20"
                placeholder="Spielername"
                aria-label="Spieler zum Angriffsverband einladen"
              />
              <button class="small" data-act="inviteUnion" data-id={union.id}
                >Einladen</button
              >
            </div>{/if}
          {#if union.joins}<div class="mt">
              <button class="small" data-act="joinUnion" data-id={union.id}
                >Beitreten</button
              >
            </div>{/if}
        </div>
      {/each}
      {#if page.unions.unions.length}<div class="dim mt">{UNION_HINT}</div>{/if}
    </div>
  </div>
{/if}
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
                  value={fleetForm.ships[ship.key]}
                  oninput={(e) =>
                    (fleetForm.ships[ship.key] = e.currentTarget.value)}
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
            <td><label for="t_q">Schnellwahl</label></td>
            <td
              ><select id="t_q" disabled={!form.quick.length}
                ><option value="">{QUICK_FIRST}</option
                >{#each form.quick as place (place.id)}<option value={place.id}
                    >{place.label}</option
                  >{/each}</select
              ></td
            >
          </tr>
          <tr>
            <td>Ziel</td>
            <td
              ><input
                class="c3"
                type="number"
                id="t_g"
                value={shown(fleetForm.to.g, target.g)}
                oninput={(e) => (fleetForm.to.g = e.currentTarget.value)}
                min="1"
                max={target.galaxies}
                aria-label="Galaxie"
              />:<input
                class="c3"
                type="number"
                id="t_s"
                value={shown(fleetForm.to.s, target.s)}
                oninput={(e) => (fleetForm.to.s = e.currentTarget.value)}
                min="1"
                max={target.systems}
                aria-label="System"
              />:<input
                class="c3"
                type="number"
                id="t_p"
                value={shown(fleetForm.to.p, target.p)}
                oninput={(e) => (fleetForm.to.p = e.currentTarget.value)}
                min="1"
                max={target.positions}
                aria-label="Position"
              />
              <select
                id="t_k"
                aria-label="Zielart"
                onchange={(e) =>
                  (fleetForm.kind =
                    e.currentTarget.value === 'moon' ? 'moon' : 'planet')}
                ><option value="planet">Planet</option><option
                  value="moon"
                  disabled={!choice.moon}
                  selected={choice.kind === 'moon'}>Mond</option
                ></select
              >
              <span id="t_info" class="dim"></span></td
            >
          </tr>
          <tr>
            <td>Auftrag</td>
            <td
              ><select
                id="t_m"
                aria-label="Auftrag"
                onchange={(e) => (fleetForm.mission = e.currentTarget.value)}
                >{#each choice.missions as option (option.value)}<option
                    value={option.value}
                    selected={option.selected}
                    disabled={option.disabled}>{option.label}</option
                  >{/each}</select
              >
              <span id="t_limit" class="dim">{choice.limit}</span></td
            >
          </tr>
          {#if form.unions.length || (form.plans && choice.mission === 'attack')}
            <tr id="t_union_row">
              <td><label for="t_u">Verband</label></td>
              <td
                ><select
                  id="t_u"
                  onchange={(e) => (fleetForm.union = e.currentTarget.value)}
                  ><option value="">Kein Verband</option
                  >{#if form.plans && choice.mission === 'attack'}<option
                      value={PLAN_OPTION.value}
                      selected={choice.union === PLAN}
                      >{PLAN_OPTION.label}</option
                    >{/if}{#each form.unions as union (union.value)}<option
                      value={union.value}
                      selected={union.value === choice.union}
                      >{union.label}</option
                    >{/each}</select
                ></td
              >
            </tr>
            {#if choice.union === PLAN}
              <tr id="t_plan_row">
                <td><label for="t_ux">Ankunft des Verbands</label></td>
                <td
                  ><input
                    type="datetime-local"
                    id="t_ux"
                    value={choice.plan}
                    oninput={(e) => (fleetForm.plan = e.currentTarget.value)}
                  /></td
                >
              </tr>
            {/if}
          {/if}
          {#if choice.stays}
            <tr id="t_stay_row">
              <td>Haltezeit</td>
              <td
                ><input
                  class="c3"
                  type="number"
                  id="t_stay"
                  min="1"
                  max={choice.stayMost}
                  value={choice.stay}
                  oninput={(e) => (fleetForm.stay = e.currentTarget.value)}
                  aria-label="Haltezeit in Stunden"
                />
                Stunden am Ziel
                <span id="t_real" class="dim">{choice.real}</span></td
              >
            </tr>
          {:else}
            <tr id="t_hold" hidden={!choice.holds}>
              <td><label for="t_h">Haltezeit</label></td>
              <td
                ><select
                  id="t_h"
                  onchange={(e) => (fleetForm.hold = e.currentTarget.value)}
                  >{#each HOLD_HOURS as hours (hours)}<option
                      value={String(hours)}
                      selected={choice.hold === String(hours)}
                      >{hoursLabel(hours)}</option
                    >{/each}</select
                ></td
              >
            </tr>
          {/if}
          <tr>
            <td>Geschwindigkeit</td>
            <td
              ><select
                id="t_v"
                aria-label="Geschwindigkeit"
                onchange={(e) => (fleetForm.speed = e.currentTarget.value)}
                >{#each SPEEDS as speed (speed.value)}<option
                    value={speed.value}
                    selected={fleetForm.speed === speed.value}
                    >{speed.label}</option
                  >{/each}</select
              ></td
            >
          </tr>
          <tr>
            <td>Ladung (Adamant / Psikristall / Promethium)</td>
            <td
              >{#each CARGO_FIELDS as field, i (field.key)}{#if i}{' '}{/if}<span
                  class="cargo"
                  ><input
                    type="number"
                    id="c_{field.key}"
                    value={fleetForm.cargo[field.key]}
                    oninput={(e) => {
                      fleetForm.cargo[field.key] = e.currentTarget.value;
                      // Typed by hand, the field is a number again (#407).
                      fleetForm.cargoAll = typedCargo(
                        fleetForm.cargoAll,
                        field.key,
                      );
                    }}
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
        <button
          id="t_send"
          data-act="send"
          data-full={form.full ? '1' : ''}
          disabled={form.full || !choice.mission}>Flotte losschicken</button
        >
        {#if form.full}<span class="bad"
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
{#if page.jump}
  <div class="box">
    <div class="hd">Warp-Tor</div>
    <div class="bd">
      <div>
        <label for="jg_to">Zielmond</label>
        <select
          id="jg_to"
          class="jump-to"
          disabled={!page.jump.targets.length}
          onchange={(e) => (fleetForm.jump = e.currentTarget.value)}
        >
          {#each page.jump.targets as place (place.value)}<option
              value={place.value}
              disabled={place.disabled}
              selected={fleetForm.jump === place.value && !place.disabled}
              >{place.label}</option
            >{/each}
        </select>
      </div>
      <div class="mt10">
        <button data-act="jump" disabled={!page.jump.canJump}>Springen</button
        >{#if page.jump.cooling}
          <span class="dim"
            >Wieder bereit in <Due due={page.jump.cooling} /></span
          >{/if}
      </div>
    </div>
  </div>
{/if}
