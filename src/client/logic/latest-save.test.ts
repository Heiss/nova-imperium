// One save at a time, the newest value last (#455): two quick changes never
// end with the older one stored.
import { describe, expect, it } from 'vitest';
import { latestSaver } from './latest-save.ts';

/** A save whose answers come when the test lets them. */
function server() {
  const sent: boolean[] = [];
  const answers: (() => void)[] = [];
  const save = (on: boolean) => {
    sent.push(on);
    return new Promise<void>((resolve) => answers.push(resolve));
  };
  const answer = async () => {
    answers.shift()!();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { sent, save, answer };
}

describe('the save of the newest value (#455)', () => {
  it('sends one value at a time and the newest after the running one', async () => {
    const s = server();
    const change = latestSaver(s.save);
    const done = change(true);
    void change(false);
    void change(true);
    void change(false);
    // Only the first is on its way.
    expect(s.sent).toEqual([true]);
    await s.answer();
    // Then the newest, once; the values in between are never sent.
    expect(s.sent).toEqual([true, false]);
    await s.answer();
    await done;
    expect(s.sent).toEqual([true, false]);
  });

  it('sends nothing more when the newest is the value of the running save', async () => {
    const s = server();
    const change = latestSaver(s.save);
    const done = change(true);
    void change(false);
    void change(true);
    await s.answer();
    await done;
    expect(s.sent).toEqual([true]);
  });

  it('starts again after the last save returned, also after one that threw', async () => {
    const sent: boolean[] = [];
    let fail = true;
    const change = latestSaver(async (on: boolean) => {
      sent.push(on);
      if (fail) {
        fail = false;
        throw new Error('down');
      }
    });
    await expect(change(true)).rejects.toThrow('down');
    await change(false);
    expect(sent).toEqual([true, false]);
  });
});
