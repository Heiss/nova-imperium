// What the open Runden-Rewind remembers (#235, view G): the card and the play.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetRewind,
  rewindUi,
  togglePlay,
  turnRewind,
} from './round-rewind.svelte.ts';

beforeEach(resetRewind);

describe('turning the cards', () => {
  it('starts on the first card, standing still', () => {
    expect(rewindUi).toEqual({ index: 0, playing: false });
  });

  it('turns forward and back and stays inside the cards', () => {
    turnRewind(1, 3);
    expect(rewindUi.index).toBe(1);
    turnRewind(1, 3);
    turnRewind(1, 3);
    expect(rewindUi.index).toBe(2);
    turnRewind(-1, 3);
    turnRewind(-1, 3);
    turnRewind(-1, 3);
    expect(rewindUi.index).toBe(0);
  });

  it('pauses the play when the player turns a card', () => {
    togglePlay(3);
    expect(rewindUi.playing).toBe(true);
    turnRewind(1, 3);
    expect(rewindUi).toEqual({ index: 1, playing: false });
  });

  it('goes on playing when the play itself turns, and stops at the last card', () => {
    togglePlay(3);
    turnRewind(1, 3, true);
    expect(rewindUi).toEqual({ index: 1, playing: true });
    turnRewind(1, 3, true);
    expect(rewindUi).toEqual({ index: 2, playing: false });
  });
});

describe('the automatic play', () => {
  it('starts and pauses where it is', () => {
    togglePlay(3);
    expect(rewindUi.playing).toBe(true);
    turnRewind(1, 3, true);
    togglePlay(3);
    expect(rewindUi).toEqual({ index: 1, playing: false });
    togglePlay(3);
    expect(rewindUi).toEqual({ index: 1, playing: true });
  });

  it('plays again from the first card after the last', () => {
    turnRewind(2, 3);
    togglePlay(3);
    expect(rewindUi).toEqual({ index: 0, playing: true });
  });

  it('has nothing to play with one card', () => {
    togglePlay(1);
    expect(rewindUi).toEqual({ index: 0, playing: false });
  });

  it('is reset when a Rewind is opened', () => {
    togglePlay(3);
    turnRewind(1, 3, true);
    resetRewind();
    expect(rewindUi).toEqual({ index: 0, playing: false });
  });
});
