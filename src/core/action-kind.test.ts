import { describe, expect, it } from 'vitest';
import { ACTION_KIND, countsAsPlayAction } from './action-kind.ts';
import { ACTION_INPUTS } from './actions.gen.ts';

const declared = ACTION_INPUTS.flatMap(([, inputs]) => Object.keys(inputs));

describe('ACTION_KIND (#335)', () => {
  it('gives every action a class', () => {
    for (const name of declared)
      expect(Object.hasOwn(ACTION_KIND, name), name).toBe(true);
  });

  it('has no class for a name that is not an action', () => {
    expect(Object.keys(ACTION_KIND).sort()).toEqual([...declared].sort());
  });

  it('classifies the deliberate reads, the view reads and the automatic writes as decided', () => {
    const of = (kind: string) =>
      Object.entries(ACTION_KIND)
        .filter(([, k]) => k === kind)
        .map(([n]) => n)
        .sort();
    expect(of('click')).toEqual(
      [
        'olderPrivateMessages',
        'openPrivateConversation',
        'roundParticipant',
        'roundReport',
        'roundRewind',
        'scan',
        'sentPrivateMessages',
      ].sort(),
    );
    expect(of('view')).toEqual(['roundArchive', 'roundHistory']);
    expect(of('auto')).toEqual(
      ['read', 'readPrivateMessages', 'seeGuildChat'].sort(),
    );
  });
});

describe('countsAsPlayAction', () => {
  it('counts a change and a deliberate read', () => {
    for (const name of ['build', 'send', 'trade', 'scan', 'roundReport'])
      expect(countsAsPlayAction(name), name).toBe(true);
  });

  it('does not count a read of a view or an automatic write', () => {
    for (const name of ['roundArchive', 'roundHistory', 'read', 'seeGuildChat'])
      expect(countsAsPlayAction(name), name).toBe(false);
  });

  it('does not count an unknown name, however it is spelled', () => {
    for (const name of ['unknown', '', 'toString', '__proto__', 'Build'])
      expect(countsAsPlayAction(name), name).toBe(false);
  });
});
