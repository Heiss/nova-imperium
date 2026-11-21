import { describe, expect, it } from 'vitest';
import { FieldDrafts, isTracked, type Field } from './field-drafts.ts';

const f = (id: string, value = '', over: Partial<Field> = {}): Field => ({
  id,
  value,
  ...over,
});

describe('the fields that have a draft', () => {
  it('leaves out what shows the server or keeps a draft of its own', () => {
    for (const id of [
      'set_speed',
      'inv_link',
      'dissolve_tag',
      'chat_text',
      'friend_name',
      'achievement_search',
      'achievement_category',
      'achievement_status',
      'g_g',
      'g_s',
      'market-give',
      'market-get',
      'market-amount',
      'f_fighter',
      't_g',
      't_s',
      't_p',
      't_v',
      't_k',
      't_m',
      't_u',
      'c_m',
      'c_c',
      'c_d',
      'un_name_f1',
      'o_probes',
      'o_explain',
      'o_levels',
      'o_main',
      'pw_current',
      'pw_next',
      'pw_confirm',
      'passkey-password',
      'reportform-text',
      'guild_tag',
      'guild_name',
      'guild_description',
      'rank_name_r1',
      'rank_new',
      'rank_of_u1',
      'rank_r1_chat',
      'inv_email',
      'announce-text',
      'audit-player',
      'audit-outcome',
    ])
      expect(isTracked(id), id).toBe(false);
    for (const id of ['t_h', 'jg_to', 'o_anim', 'q_lc', 'td_lc'])
      expect(isTracked(id), id).toBe(true);
  });

  it('matches the whole id, not a part of it', () => {
    for (const id of ['xset_speed', 'inv_link2', 'my_inv_email', 'o_probes_x'])
      expect(isTracked(id), id).toBe(true);
  });
});

describe('the drafts of the fields', () => {
  it('gives back what was typed after a redraw put the value of the state', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('q_lc', '7'));
    expect(drafts.restore(f('q_lc', '1'))).toEqual({ value: '7' });
  });

  it('takes the newest value and gives nothing for a field never changed', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('q_lc', '7'));
    drafts.record(f('q_lc', '8'));
    expect(drafts.restore(f('q_lc'))).toEqual({ value: '8' });
    // Strict: not even a key without a value for a field never changed.
    expect(drafts.restore(f('td_lc'))).toStrictEqual({});
  });

  it('keeps an emptied field empty', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('td_lc', '3'));
    drafts.record(f('td_lc', ''));
    expect(drafts.restore(f('td_lc', 'old'))).toEqual({ value: '' });
  });

  it('records no field without a draft', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('set_speed', '9'));
    drafts.record(f('inv_link', 'x'));
    expect(drafts.restore(f('set_speed', '5'))).toEqual({});
  });

  it('does not restore onto a disabled option of a select', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('jg_to', 'm2'));
    const options = [
      { value: 'm1', disabled: false },
      { value: 'm2', disabled: true },
    ];
    expect(drafts.restore(f('jg_to', 'm1', { options }))).toEqual({});
    options[1]!.disabled = false;
    expect(drafts.restore(f('jg_to', 'm1', { options }))).toEqual({
      value: 'm2',
    });
  });

  it('records no rank box: the form of the guild keeps its ticks (#332, the disabled box in views/guild-form.test.ts)', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('rank_r1_chat', 'chat'));
    drafts.record(f('rank_r1_war', 'war'));
    expect(drafts.restore(f('rank_r1_chat', 'chat'))).toEqual({});
    expect(drafts.restore(f('rank_r1_war', 'war'))).toEqual({});
  });

  it('drops every draft on reset (a fresh render, a logout)', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('q_lc', '7'));
    drafts.record(f('td_lc', '3'));
    drafts.reset();
    expect(drafts.restore(f('q_lc', '1'))).toEqual({});
    expect(drafts.restore(f('td_lc', ''))).toEqual({});
  });
});
