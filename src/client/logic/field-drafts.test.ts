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
      'c_m',
      'c_c',
      'c_d',
      'un_name_f1',
    ])
      expect(isTracked(id), id).toBe(false);
    for (const id of [
      'inv_email',
      't_k',
      't_m',
      't_h',
      'jg_to',
      'o_probes',
      'guild_tag',
    ])
      expect(isTracked(id), id).toBe(true);
  });
});

describe('the drafts of the fields', () => {
  it('gives back what was typed after a redraw put the value of the state', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('o_probes', '7'));
    expect(drafts.restore(f('o_probes', '1'))).toEqual({ value: '7' });
  });

  it('takes the newest value and gives nothing for a field never changed', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('o_probes', '7'));
    drafts.record(f('o_probes', '8'));
    expect(drafts.restore(f('o_probes'))).toEqual({ value: '8' });
    expect(drafts.restore(f('guild_name'))).toEqual({});
  });

  it('keeps an emptied field empty', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('inv_email', 'a@b.de'));
    drafts.record(f('inv_email', ''));
    expect(drafts.restore(f('inv_email', 'old'))).toEqual({ value: '' });
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

  it('keeps a ticked or cleared rank box, but not onto a disabled one (#163)', () => {
    const drafts = new FieldDrafts();
    drafts.record(
      f('rank_r1_chat', 'chat', { rankRight: true, checked: true }),
    );
    drafts.record(f('rank_r1_war', 'war', { rankRight: true, checked: false }));
    expect(
      drafts.restore(
        f('rank_r1_chat', 'chat', { rankRight: true, checked: false }),
      ),
    ).toEqual({ checked: true });
    expect(
      drafts.restore(
        f('rank_r1_war', 'war', { rankRight: true, checked: true }),
      ),
    ).toEqual({ checked: false });
    expect(
      drafts.restore(
        f('rank_r1_chat', 'chat', { rankRight: true, disabled: true }),
      ),
    ).toEqual({});
  });

  it('drops every draft on reset (a fresh render, a logout)', () => {
    const drafts = new FieldDrafts();
    drafts.record(f('o_probes', '7'));
    drafts.record(
      f('rank_r1_chat', 'chat', { rankRight: true, checked: true }),
    );
    drafts.reset();
    expect(drafts.restore(f('o_probes', '1'))).toEqual({});
    expect(drafts.restore(f('rank_r1_chat', '', { rankRight: true }))).toEqual(
      {},
    );
  });
});
