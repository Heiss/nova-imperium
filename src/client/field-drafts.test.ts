import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldDrafts } from './logic/field-drafts.ts';

class Input {
  id: string;
  value: string;
  checked = false;
  disabled = false;
  constructor(id: string, value = '') {
    this.id = id;
    this.value = value;
  }
  hasAttribute = () => false;
  closest = (sel: string) => (sel === '#view' ? {} : null);
}

let listeners: Record<string, (e: unknown) => void>;
let page: Input[];
let mod: typeof import('./field-drafts.ts');

beforeEach(async () => {
  vi.stubGlobal('HTMLInputElement', Input);
  vi.stubGlobal('HTMLSelectElement', class {});
  vi.stubGlobal('HTMLTextAreaElement', class {});
  listeners = {};
  page = [];
  vi.stubGlobal('document', {
    addEventListener: (t: string, l: (e: unknown) => void) =>
      (listeners[t] = l),
  });
  mod = await import('./field-drafts.ts');
  fieldDrafts.reset();
});
afterEach(() => vi.unstubAllGlobals());

const view = () => ({ querySelectorAll: () => page }) as unknown as HTMLElement;

describe('the drafts of the page', () => {
  it('records a change of a field of the view and puts it back into the redrawn view', () => {
    mod.trackFields();
    const typed = new Input('t_g', '7');
    listeners.input!({ target: typed });
    const redrawn = new Input('t_g', '1');
    page = [redrawn];
    mod.restoreFields(view());
    expect(redrawn.value).toBe('7');
  });

  it('records the choice of a select by its change', () => {
    mod.trackFields();
    listeners.change!({ target: new Input('t_m', 'attack') });
    const redrawn = new Input('t_m', 'spy');
    page = [redrawn];
    mod.restoreFields(view());
    expect(redrawn.value).toBe('attack');
  });

  it('records a field that a button fills, as the player’s', () => {
    const field = new Input('f_fighter');
    mod.writeField(field as never, '6');
    expect(field.value).toBe('6');
    const redrawn = new Input('f_fighter');
    page = [redrawn];
    mod.restoreFields(view());
    expect(redrawn.value).toBe('6');
  });

  it('records what setById writes, as writeField does (the settings of the admin page use it)', async () => {
    const field = new Input('t_g');
    vi.stubGlobal('document', { getElementById: () => field });
    const { setById } = await import('./dom.ts');
    setById('t_g', '8');
    expect(field.value).toBe('8');
    page = [new Input('t_g', '1')];
    mod.restoreFields(view());
    expect(page[0]!.value).toBe('8');
  });

  it('ignores a field outside the view, one without an id and one without a draft', () => {
    mod.trackFields();
    const outside = new Input('planet_select', '2');
    outside.closest = () => null;
    listeners.change!({ target: outside });
    listeners.input!({ target: new Input('', 'x') });
    listeners.input!({ target: new Input('set_speed', '9') });
    listeners.input!({ target: {} });
    page = [new Input('planet_select', '1'), new Input('set_speed', '5')];
    mod.restoreFields(view());
    expect(page.map((p) => p.value)).toEqual(['1', '5']);
  });

  it('forgets everything on a fresh render', () => {
    mod.trackFields();
    listeners.input!({ target: new Input('t_g', '7') });
    mod.forgetFields();
    const redrawn = new Input('t_g', '1');
    page = [redrawn];
    mod.restoreFields(view());
    expect(redrawn.value).toBe('1');
  });
});
