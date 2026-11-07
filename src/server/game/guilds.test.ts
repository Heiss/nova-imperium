import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { guildState } from './guilds.ts';

describe('guilds', () => {
  it('publishes a safe Markdown profile and ranks approved members by points', () => {
    const ctx = testCtx();
    const founder = addUser(ctx, 'Anna');
    const applicant = addUser(ctx, 'Ben');
    runAction(ctx, founder.id, {
      type: 'createGuild',
      name: 'Outer Rim',
      tag: 'or',
      description:
        '**Hallo** <script>x</script> [bad](javascript:alert(1)) ![remote](https://example.org/pixel.png)',
    });
    const first = guildState(ctx, founder.id, {}).directory[0]!;
    expect(first.tag).toBe('OR');
    expect(first.html).toContain('<strong>Hallo</strong>');
    expect(first.html).not.toContain('<script>');
    expect(first.html).not.toContain('href="javascript:');
    expect(first.html).not.toContain('<img');
    runAction(ctx, applicant.id, { type: 'applyToGuild', id: first.id });
    expect(guildState(ctx, applicant.id, {}).management).toBeNull();
    expect(guildState(ctx, founder.id, {}).management?.pending).toEqual([
      { id: applicant.id, name: 'Ben' },
    ]);
    expect(() =>
      runAction(ctx, applicant.id, {
        type: 'reviewGuildApplication',
        uid: applicant.id,
        accept: true,
      }),
    ).toThrow('Gildenleitung');
    runAction(ctx, founder.id, {
      type: 'reviewGuildApplication',
      uid: applicant.id,
      accept: true,
    });
    const g = guildState(ctx, applicant.id, {
      [founder.id]: 20,
      [applicant.id]: 40,
    }).directory[0]!;
    expect(g).toMatchObject({
      score: 60,
      average: 30,
      members: [{ id: applicant.id }, { id: founder.id }],
    });
    expect(guildState(ctx, founder.id, {}).management?.pending).toEqual([]);
  });

  it('supports rejecting and withdrawing applications, leadership transfer, and leaving', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Ben');
    const c = addUser(ctx, 'Cara');
    runAction(ctx, a.id, { type: 'createGuild', name: 'Outer Rim', tag: 'OR' });
    const id = guildState(ctx, a.id, {}).own!.id;
    expect(() =>
      runAction(ctx, b.id, {
        type: 'createGuild',
        name: 'Outer Rim',
        tag: 'or',
      }),
    ).toThrow('schon vergeben');
    runAction(ctx, b.id, { type: 'applyToGuild', id });
    runAction(ctx, a.id, {
      type: 'reviewGuildApplication',
      uid: b.id,
      accept: false,
    });
    expect(guildState(ctx, b.id, {}).own).toBeNull();
    runAction(ctx, b.id, { type: 'applyToGuild', id });
    runAction(ctx, b.id, { type: 'leaveGuild' });
    runAction(ctx, b.id, { type: 'applyToGuild', id });
    runAction(ctx, a.id, {
      type: 'reviewGuildApplication',
      uid: b.id,
      accept: true,
    });
    expect(() => runAction(ctx, a.id, { type: 'leaveGuild' })).toThrow(
      'Übergib',
    );
    expect(() =>
      runAction(ctx, c.id, { type: 'updateGuild', tag: 'OR', name: 'Other' }),
    ).toThrow('keiner Gilde');
    runAction(ctx, a.id, {
      type: 'manageGuildMember',
      uid: b.id,
      transfer: true,
    });
    runAction(ctx, b.id, {
      type: 'updateGuild',
      tag: 'NEW',
      name: 'New Frontier',
    });
    runAction(ctx, b.id, { type: 'manageGuildMember', uid: a.id });
    expect(guildState(ctx, a.id, {}).own).toBeNull();
    expect(guildState(ctx, b.id, {}).directory[0]).toMatchObject({
      tag: 'NEW',
      founder: b.id,
    });
    runAction(ctx, b.id, { type: 'leaveGuild' });
    expect(guildState(ctx, b.id, {}).directory).toEqual([]);
  });
});
