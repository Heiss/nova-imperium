import { describe, expect, it } from 'vitest';
import { PUSH_TOPICS } from '../../core/push.ts';
import { pushKindsHTML, pushOffOf } from './push-options.ts';

/** The box on a server with Web Push. */
const pushOptionsHTML = (off: readonly string[] | undefined): string =>
  pushKindsHTML(true, off);

const boxes = (html: string): string[] => html.match(/<input [^>]*>/g) ?? [];

describe('push options in „Hilfe & Optionen“ (#192)', () => {
  it('shows one checkbox per kind with its German name, all on by default', () => {
    const html = pushOptionsHTML([]);
    expect(html).toMatch(
      /^<p>Gilt für alle deine Geräte mit aktivierten Browser-Benachrichtigungen\. Eine Änderung wird sofort gespeichert\.<\/p><fieldset class="push-kinds"><legend>Welche Meldungen per Push kommen<\/legend><label class="switch">/,
    );
    expect(boxes(html)).toEqual(
      PUSH_TOPICS.map(
        (t) => `<input type="checkbox" id="push_${t}" data-chg="push" checked>`,
      ),
    );
    expect(html).toContain('> Gebäude fertig</label>');
    expect(html).toContain('> Sturmangriff auf deine Planeten</label>');
    expect(html).toContain('> Nachrichten im Gilden-Chat</label>');
    expect(html.match(/<\/label>/g)).toHaveLength(PUSH_TOPICS.length);
    expect(html.match(/<\/label><label class="switch">/g)).toHaveLength(
      PUSH_TOPICS.length - 1,
    );
    expect(html).toMatch(/<\/label><\/fieldset>$/);
    expect(html).not.toContain('undefined');
    expect(pushOptionsHTML(undefined)).toBe(html);
  });

  it('is hidden on a server without Web Push (owner, 2026-11-14)', () => {
    expect(pushKindsHTML(false, [])).toBe('');
    expect(pushKindsHTML(undefined, ['news'])).toBe('');
  });

  it('shows on a server with Web Push', () => {
    expect(pushKindsHTML(true, [])).toContain('<fieldset class="push-kinds">');
  });

  it('names every kind ([E], owner 2026-11-14)', () => {
    const names = [...pushOptionsHTML([]).matchAll(/> ([^<]+)<\/label>/g)].map(
      (m) => m[1],
    );
    expect(names).toEqual([
      'Gebäude fertig',
      'Forschung abgeschlossen',
      'Auftrag der Schiffsschmiede abgeschlossen',
      'Eigene Flotten: Ankunft, Bericht und Rückkehr',
      'Sturmangriff auf deine Planeten',
      'Auspex-Aktivität bei deinen Planeten',
      'Lieferung eines anderen Spielers',
      'Servernachrichten',
      'Neue Version',
      'Gildenereignisse',
      'Nachrichten im Gilden-Chat',
    ]);
  });

  it('leaves the kinds that are off unchecked', () => {
    const html = pushOptionsHTML(['news', 'guild-chat']);
    expect(boxes(html).filter((b) => !b.includes('checked'))).toEqual([
      '<input type="checkbox" id="push_news" data-chg="push">',
      '<input type="checkbox" id="push_guild-chat" data-chg="push">',
    ]);
  });

  it('reads the kinds that are off from the checkboxes; a missing one is on', () => {
    const state: Record<string, boolean> = {
      push_fleet: false,
      push_research: true,
      push_announcement: false,
    };
    expect(pushOffOf((id) => state[id])).toEqual(['fleet', 'announcement']);
    expect(pushOffOf(() => undefined)).toEqual([]);
  });
});
