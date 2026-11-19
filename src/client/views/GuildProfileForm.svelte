<script lang="ts">
  // The form to found a guild, or for its Leitung to change it (#163); sent by
  // features/guilds.ts (`guildform`, which reads `data-edit`).
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
      value={form.tag}
    />
  </div>
  <div>
    <label for="guild_name">Name</label>
    <input
      id="guild_name"
      required
      minlength="3"
      maxlength="32"
      value={form.name}
    />
  </div>
  <div>
    <label for="guild_description">Gildentext (Markdown)</label><br />
    <textarea
      id="guild_description"
      class="wide"
      rows="6"
      maxlength="6000"
      value={form.description}></textarea>
  </div>
  <button type="submit"
    >{form.edit ? 'Profil speichern' : 'Gilde gründen'}</button
  >
</form>
