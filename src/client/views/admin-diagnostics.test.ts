import { describe, expect, it } from 'vitest';
import { eventDetail } from './admin-diagnostics.ts';

type Row = Parameters<typeof eventDetail>[0];

const event = (over: Partial<Row>): Row => ({
  id: 7,
  time: 0,
  actor: 'a1',
  actorName: 'Sturm',
  category: 'system',
  action: 'battle',
  outcome: 'ok',
  target: 'b1',
  requestId: null,
  detail: '{}',
  ...over,
});

/** Every button of the markup: its attributes and its text. */
const buttons = (html: string) =>
  [...html.matchAll(/<button ([^>]*)>([^<]*)<\/button>/g)].map(
    ([, attributes, label]) => ({ attributes, label }),
  );

describe('eventDetail (#151)', () => {
  it('offers „Ereignisse zu …“ for the planet and the fleet of a battle', () => {
    const html = eventDetail(
      event({
        detail: JSON.stringify({
          fleet: 'IY6nvG1yQ1E3',
          planet: 'p1_35_6',
          winner: 'att',
          scheduled: 1794576262259,
        }),
      }),
    );
    expect(buttons(html)).toEqual([
      {
        attributes:
          'type="button" data-diagnostics="reference" data-reference="p1_35_6"',
        label: 'Ereignisse zu p1_35_6',
      },
      {
        attributes:
          'type="button" data-diagnostics="reference" data-reference="IY6nvG1yQ1E3"',
        label: 'Ereignisse zu IY6nvG1yQ1E3',
      },
    ]);
    expect(html).not.toContain('Aufträge');
    expect(html).not.toContain('data-diagnostics="orders"');
    expect(html).toContain('<summary>Kampfdetails 7</summary>');
  });

  it('offers a button only for the references the event has', () => {
    const fleet = eventDetail(event({ detail: '{"fleet":"f1"}' }));
    expect(buttons(fleet).map((b) => b.label)).toEqual(['Ereignisse zu f1']);
    const planet = eventDetail(event({ detail: '{"planet":"p1_2_3"}' }));
    expect(buttons(planet).map((b) => b.label)).toEqual([
      'Ereignisse zu p1_2_3',
    ]);
  });

  it('offers no button for an event without planet or fleet', () => {
    const html = eventDetail(
      event({ action: 'login', detail: '{"source":"operator"}' }),
    );
    expect(buttons(html)).toEqual([]);
    expect(html).toBe(
      '<details><summary>Ereignis 7</summary><code>{&quot;source&quot;:&quot;operator&quot;}</code><div class="flex"></div></details>',
    );
  });

  it('separates the buttons by a space', () => {
    const html = eventDetail(event({ detail: '{"planet":"p","fleet":"f"}' }));
    expect(html).toContain('Ereignisse zu p</button> <button');
  });

  it('escapes the references in the attribute and the label', () => {
    const html = eventDetail(event({ detail: '{"planet":"<i>\\"x\'&"}' }));
    expect(buttons(html)).toEqual([
      {
        attributes:
          'type="button" data-diagnostics="reference" data-reference="&lt;i&gt;&quot;x&#39;&amp;"',
        label: 'Ereignisse zu &lt;i&gt;&quot;x&#39;&amp;',
      },
    ]);
    expect(html).not.toContain('<i>');
  });

  it('shows the request ID when the event has one', () => {
    expect(eventDetail(event({ requestId: 'r-<1>' }))).toContain(
      '<summary>Kampfdetails 7</summary><div>Vorgang <code>r-&lt;1&gt;</code></div>',
    );
    expect(eventDetail(event({}))).not.toContain('Vorgang');
  });
});
