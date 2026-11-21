<script lang="ts">
  // The form to found a guild, or for its Leitung to change it (#163); sent by
  // features/guilds.ts (`guildform`, which reads `data-edit`). What was typed
  // is the state of logic/guild-form.svelte.ts (#332).
  import { guildForm } from '../logic/guild-form.svelte.ts';
  import type { ProfileFormModel } from '../logic/guilds.ts';

  let { form }: { form: ProfileFormModel } = $props();
</script>

<form id="guildform" data-edit={form.edit ? '1' : '0'}>
  <div>
    <label for="guild_tag">Kürzel</label>
    <input
      id="guild_tag"
      required
      minlength="2"
      maxlength="8"
      value={guildForm.tag ?? form.tag}
      oninput={(e) => (guildForm.tag = e.currentTarget.value)}
    />
  </div>
  <div>
    <label for="guild_name">Name</label>
    <input
      id="guild_name"
      required
      minlength="3"
      maxlength="32"
      value={guildForm.name ?? form.name}
      oninput={(e) => (guildForm.name = e.currentTarget.value)}
    />
  </div>
  <div>
    <label for="guild_description">Gildentext (Markdown)</label><br />
    <textarea
      id="guild_description"
      class="wide"
      rows="6"
      maxlength="6000"
      value={guildForm.description ?? form.description}
      oninput={(e) => (guildForm.description = e.currentTarget.value)}
    ></textarea>
  </div>
  <button type="submit"
    >{form.edit ? 'Profil speichern' : 'Gilde gründen'}</button
  >
</form>
