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
    ).toThrow('Du bist in keiner Gilde.');
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

  it('lists the members by name without points while the highscore shows nothing (#422, 182a)', () => {
    const ctx = testCtx();
    const founder = addUser(ctx, 'Zora');
    const member = addUser(ctx, 'Ben');
    runAction(ctx, founder.id, {
      type: 'createGuild',
      name: 'Outer Rim',
      tag: 'or',
    });
    const id = guildState(ctx, founder.id, {}).own!.id;
    runAction(ctx, member.id, { type: 'applyToGuild', id });
    runAction(ctx, founder.id, {
      type: 'reviewGuildApplication',
      uid: member.id,
      accept: true,
    });
    expect(guildState(ctx, founder.id, null).directory).toEqual([
      {
        id,
        tag: 'OR',
        name: 'Outer Rim',
        html: '',
        members: [
          { id: member.id, name: 'Ben' },
          { id: founder.id, name: 'Zora' },
        ],
      },
    ]);
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
      rank: `r1_${id}`,
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
    });
    // The Leitung is a rank and shows only inside the guild (#163, D7).
    expect(guildState(ctx, b.id, {}).ranks?.lead).toBe(b.id);
    expect(ctx.guilds.get(id)?.founder).toBe(b.id);
    expect(guildState(ctx, c.id, {}).directory[0]).not.toHaveProperty(
      'founder',
    );
    runAction(ctx, b.id, { type: 'leaveGuild' });
    expect(guildState(ctx, b.id, {}).directory).toEqual([]);
  });
});

describe('guild rules (#117: the logic left in guilds.ts)', () => {
  const found = (
    ctx: ReturnType<typeof testCtx>,
    uid: string,
    d: Record<string, unknown> = {},
  ) =>
    runAction(ctx, uid, {
      type: 'createGuild',
      tag: 'OR',
      name: 'Outer Rim',
      ...d,
    });

  it('leaves a bare address in the profile text as text, not a link', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    found(ctx, a.id, { description: 'Treffpunkt https://example.org heute' });
    const html = guildState(ctx, a.id, {}).directory[0]!.html;
    expect(html).toBe('<p>Treffpunkt https://example.org heute</p>\n');
  });

  it('checks the tag, the name and the text of a profile', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    for (const tag of ['A', 'ABCDEFGHI', '#AB', 'AB#', 'A B'])
      expect(() => found(ctx, a.id, { tag })).toThrow('Kürzel braucht');
    for (const name of ['ab', 'x'.repeat(33)])
      expect(() => found(ctx, a.id, { name })).toThrow('Gildenname braucht');
    expect(() => found(ctx, a.id, { description: 'x'.repeat(6001) })).toThrow(
      'höchstens 6.000',
    );
    expect(
      found(ctx, a.id, {
        tag: 'ab12cd34',
        name: 'x'.repeat(32),
        description: ` ${'y'.repeat(6000)} `,
      }),
    ).toBe('Gilde gegründet.');
    const state = guildState(ctx, a.id, {});
    expect(state.directory[0]).toMatchObject({ tag: 'AB12CD34' });
    expect(state.management?.description).toBe('y'.repeat(6000));
    expect(
      runAction(ctx, a.id, { type: 'updateGuild', tag: 'NEW', name: 'abc' }),
    ).toBe('Gildenprofil gespeichert.');
    expect(guildState(ctx, a.id, {}).management?.description).toBe('');
  });

  it('refuses a second guild, an unknown guild and a second application', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Ben');
    found(ctx, a.id);
    expect(() => found(ctx, a.id, { tag: 'XY', name: 'Other' })).toThrow(
      'bereits eine Gilde',
    );
    expect(() =>
      runAction(ctx, b.id, { type: 'applyToGuild', id: 'none' }),
    ).toThrow('Diese Gilde gibt es nicht.');
    const id = guildState(ctx, a.id, {}).own!.id;
    expect(runAction(ctx, b.id, { type: 'applyToGuild', id })).toBe(
      'Bewerbung gesendet.',
    );
    expect(guildState(ctx, b.id, {}).own).toEqual({ id, status: 'pending' });
    expect(() => runAction(ctx, b.id, { type: 'applyToGuild', id })).toThrow(
      'bereits eine Gilde',
    );
    expect(() => found(ctx, b.id, { tag: 'XY', name: 'Other' })).toThrow(
      'bereits eine Gilde',
    );
    expect(runAction(ctx, b.id, { type: 'leaveGuild' })).toBe(
      'Bewerbung zurückgezogen.',
    );
    expect(() => runAction(ctx, b.id, { type: 'leaveGuild' })).toThrow(
      'keiner Gilde',
    );
  });

  it('reviews only open applications to the own guild', () => {
    const ctx = testCtx();
    const [a, b, c, d] = ['Anna', 'Ben', 'Cara', 'Dora'].map((n) =>
      addUser(ctx, n),
    );
    found(ctx, a!.id);
    found(ctx, d!.id, { tag: 'XY', name: 'Other' });
    const id = guildState(ctx, a!.id, {}).own!.id;
    const other = guildState(ctx, d!.id, {}).own!.id;
    runAction(ctx, b!.id, { type: 'applyToGuild', id });
    runAction(ctx, c!.id, { type: 'applyToGuild', id: other });
    const review = (uid: string, accept?: boolean) =>
      runAction(ctx, a!.id, { type: 'reviewGuildApplication', uid, accept });
    for (const uid of ['nobody', c!.id, a!.id])
      expect(() => review(uid, true)).toThrow('Diese Bewerbung gibt es nicht.');
    expect(review(b!.id, true)).toBe('Bewerbung angenommen.');
    expect(() => review(b!.id, true)).toThrow('Diese Bewerbung gibt es nicht.');
    runAction(ctx, c!.id, { type: 'leaveGuild' });
    runAction(ctx, c!.id, { type: 'applyToGuild', id });
    expect(review(c!.id)).toBe('Bewerbung abgelehnt.');
    expect(guildState(ctx, c!.id, {}).own).toBeNull();
  });

  it('manages only members of the own guild other than the lead', () => {
    const ctx = testCtx();
    const [a, b, c, d] = ['Anna', 'Ben', 'Cara', 'Dora'].map((n) =>
      addUser(ctx, n),
    );
    found(ctx, a!.id);
    found(ctx, d!.id, { tag: 'XY', name: 'Other' });
    const id = guildState(ctx, a!.id, {}).own!.id;
    for (const u of [b!, c!])
      runAction(ctx, u.id, { type: 'applyToGuild', id });
    runAction(ctx, a!.id, {
      type: 'reviewGuildApplication',
      uid: b!.id,
      accept: true,
    });
    const manage = (uid: string, transfer?: boolean) =>
      runAction(ctx, a!.id, {
        type: 'manageGuildMember',
        uid,
        transfer,
        rank: `r1_${id}`,
      });
    for (const uid of ['nobody', c!.id, d!.id, a!.id])
      expect(() => manage(uid, true)).toThrow(
        'Dieses Gildenmitglied gibt es nicht.',
      );
    expect(() =>
      runAction(ctx, b!.id, { type: 'manageGuildMember', uid: a!.id }),
    ).toThrow('Dazu fehlt deinem Rang das Recht.');
    expect(manage(b!.id)).toBe('Mitglied entfernt.');
    runAction(ctx, b!.id, { type: 'applyToGuild', id });
    runAction(ctx, a!.id, {
      type: 'reviewGuildApplication',
      uid: b!.id,
      accept: true,
    });
    expect(manage(b!.id, true)).toBe('Gildenleitung übergeben.');
    expect(runAction(ctx, a!.id, { type: 'leaveGuild' })).toBe(
      'Gilde verlassen.',
    );
    expect(runAction(ctx, d!.id, { type: 'leaveGuild' })).toBe(
      'Gilde aufgelöst.',
    );
  });

  it('ranks the guilds by score, then by tag, and counts only members', () => {
    const ctx = testCtx();
    const [a, b, c, d] = ['Anna', 'Ben', 'Cara', 'Dora'].map((n) =>
      addUser(ctx, n),
    );
    found(ctx, a!.id, { tag: 'ZZ', name: 'Zeta' });
    found(ctx, b!.id, { tag: 'BB', name: 'Beta' });
    found(ctx, c!.id, { tag: 'AA', name: 'Alpha' });
    const id = guildState(ctx, a!.id, {}).own!.id;
    runAction(ctx, d!.id, { type: 'applyToGuild', id });
    const points = { [a!.id]: 10, [b!.id]: 10, [c!.id]: 5, [d!.id]: 100 };
    const state = guildState(ctx, b!.id, points);
    expect(state.directory.map((g) => [g.tag, g.score, g.average])).toEqual([
      ['BB', 10, 10],
      ['ZZ', 10, 10],
      ['AA', 5, 5],
    ]);
    expect(state.directory[1]!.members).toEqual([
      { id: a!.id, name: 'Anna', points: 10 },
    ]);
    expect(state.management).toEqual({
      id: state.own!.id,
      description: '',
      pending: [],
    });
    expect(guildState(ctx, a!.id, {}).management?.pending).toEqual([
      { id: d!.id, name: 'Dora' },
    ]);
    expect(guildState(ctx, d!.id, {}).management).toBeNull();
  });
});

// The checks of the guild actions are functions of src/core/guild-checks.ts
// (#214); the server words their codes. The messages are written out here,
// not imported, so a changed text or another order is noticed.
describe('the refusals of the guild actions, in their order (#214)', () => {
  const JOINED = 'Du hast bereits eine Gilde oder eine offene Bewerbung.';
  const NO_RIGHT = 'Dazu fehlt deinem Rang das Recht.';

  function setup() {
    const ctx = testCtx();
    const [a, b, c] = ['Anna', 'Ben', 'Cara'].map((n) => addUser(ctx, n));
    const run = (uid: string, d: Record<string, unknown>) =>
      runAction(ctx, uid, d);
    run(a!.id, { type: 'createGuild', tag: 'OR', name: 'Outer Rim' });
    const id = guildState(ctx, a!.id, {}).own!.id;
    run(b!.id, { type: 'applyToGuild', id });
    run(a!.id, { type: 'reviewGuildApplication', uid: b!.id, accept: true });
    return { ctx, run, a: a!.id, b: b!.id, c: c!.id, id };
  }

  it('words every refusal of a profile', () => {
    const { run, c } = setup();
    const found = (d: Record<string, unknown>) => () =>
      run(c, { type: 'createGuild', tag: 'XY', name: 'Other', ...d });
    expect(found({ tag: 'X' })).toThrow(
      'Das Kürzel braucht 2 bis 8 Buchstaben oder Ziffern.',
    );
    expect(found({ name: 'ab' })).toThrow(
      'Der Gildenname braucht 3 bis 32 Zeichen.',
    );
    expect(found({ description: 'x'.repeat(6001) })).toThrow(
      'Der Gildentext darf höchstens 6.000 Zeichen haben.',
    );
    expect(found({ tag: 'or' })).toThrow(
      'Das Kürzel oder der Name ist schon vergeben.',
    );
    expect(found({ name: 'Outer Rim' })).toThrow(
      'Das Kürzel oder der Name ist schon vergeben.',
    );
  });

  it('refuses a member before its profile, and a missing right before it', () => {
    const { run, a, b } = setup();
    expect(() => run(a, { type: 'createGuild', tag: 'X', name: 'ab' })).toThrow(
      JOINED,
    );
    expect(() => run(b, { type: 'updateGuild', tag: 'X', name: 'ab' })).toThrow(
      NO_RIGHT,
    );
    expect(() => run(a, { type: 'applyToGuild', id: 'none' })).toThrow(JOINED);
    // Its own tag and name are no other guild's.
    expect(run(a, { type: 'updateGuild', tag: 'or', name: 'Outer Rim' })).toBe(
      'Gildenprofil gespeichert.',
    );
  });

  it('checks the right before the application or the member', () => {
    const { run, b } = setup();
    expect(() =>
      run(b, { type: 'reviewGuildApplication', uid: 'nobody' }),
    ).toThrow(NO_RIGHT);
    expect(() => run(b, { type: 'manageGuildMember', uid: 'nobody' })).toThrow(
      'Dieses Gildenmitglied gibt es nicht.',
    );
  });

  it('hands over the Leitung only by the Leitung, with a rank below it', () => {
    const { ctx, run, a, b, id } = setup();
    const ranks = ctx.guilds.ranks(id);
    const hand = (who: string, uid: string, rank: unknown) => () =>
      run(who, { type: 'manageGuildMember', uid, transfer: true, rank });
    expect(hand(b, a, 'none')).toThrow('Das darf nur die Gildenleitung.');
    expect(hand(a, b, 'none')).toThrow('Diesen Rang gibt es nicht.');
    expect(hand(a, b, ranks[0]!.id)).toThrow(
      'Wähle für dich einen Rang unter der Leitung.',
    );
    expect(hand(a, b, ranks[1]!.id)()).toBe('Gildenleitung übergeben.');
    expect(() => run(b, { type: 'leaveGuild' })).toThrow(
      'Übergib zuerst die Gildenleitung.',
    );
  });
});
