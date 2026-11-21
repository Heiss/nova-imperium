import { describe, expect, it } from 'vitest';
import { headerLengths, keepHeaderInView, stacked } from './sticky-header.ts';

describe('header lengths (#193)', () => {
  it('hides the logo line when the resources are below it', () => {
    // Measured at 1,100 px: logo 12 to 58, resources from 68.
    expect(
      headerLengths({ height: 128, logoBottom: 58, resourcesTop: 68 }),
    ).toEqual({ '--head-h': '128px', '--head-hide': '58px' });
  });
  it('hides the logo line when the resources follow without a gap', () => {
    expect(
      headerLengths({ height: 100, logoBottom: 50, resourcesTop: 50 }),
    ).toEqual({ '--head-h': '100px', '--head-hide': '50px' });
  });
  it('rounds to whole pixels', () => {
    expect(
      headerLengths({ height: 127.6, logoBottom: 58.4, resourcesTop: 68.2 }),
    ).toEqual({ '--head-h': '128px', '--head-hide': '58px' });
  });
  it('hides nothing when the logo stands beside the resources', () => {
    // Measured at 1,280 px: one line, logo 13 to 59, resources from 12.
    expect(
      headerLengths({ height: 72, logoBottom: 59, resourcesTop: 12 }),
    ).toEqual({ '--head-h': '72px', '--head-hide': '0px' });
    expect(
      headerLengths({ height: 72, logoBottom: 50.5, resourcesTop: 50 }),
    ).toEqual({ '--head-h': '72px', '--head-hide': '0px' });
  });
});

describe('a header with the logo on a line of its own (#193)', () => {
  it('is stacked only when the resources start below the logo', () => {
    expect(stacked({ height: 128, logoBottom: 58, resourcesTop: 68 })).toBe(
      true,
    );
    expect(stacked({ height: 100, logoBottom: 50, resourcesTop: 50 })).toBe(
      true,
    );
    expect(stacked({ height: 72, logoBottom: 59, resourcesTop: 12 })).toBe(
      false,
    );
  });
});

describe('keeping the header in view (#193)', () => {
  /** A page whose header starts at `top` and is `height` tall. */
  function page(
    top: number,
    height: number,
    [logoTop, logoHigh, firstBarTop] = [12, 46, 68],
  ) {
    let barTop = firstBarTop;
    const box = (t: number, h: number) => ({ top: t, height: h });
    const props = new Map<string, string>();
    const classes = new Map<string, boolean>();
    const watchers: [string, () => void][] = [];
    const scrolling: (() => void)[] = [];
    let scrollY = 0;
    const part = (name: string, at: () => number, tall: number) => ({
      name,
      getBoundingClientRect: () => box(top + at(), tall),
    });
    keepHeaderInView({
      header: {
        name: 'header',
        getBoundingClientRect: () => box(top, height),
      },
      logo: part('logo', () => logoTop, logoHigh),
      resources: part('resources', () => barTop, 47),
      setProperty: (name, value) => props.set(name, value),
      observe: (target, measure) => watchers.push([target.name, measure]),
      toggle: (name, on) => classes.set(name, on),
      scrolled: () => scrollY > 0,
      onScroll: (listener) => scrolling.push(listener),
    });
    return {
      props,
      classes,
      watchers,
      /** The bar moves, as when the line breaks or no longer does. */
      moveBar(to: number, tall: number) {
        barTop = to;
        height = tall;
      },
      scroll(to: number) {
        scrollY = to;
        for (const listener of scrolling) listener();
      },
      grow(by: number) {
        height += by;
        top -= by;
      },
    };
  }

  it('measures the header at once, from its own top', () => {
    const p = page(-30, 128);
    expect(Object.fromEntries(p.props)).toEqual({
      '--head-h': '128px',
      '--head-hide': '58px',
    });
  });

  it('measures again when the header or the bar changes size', () => {
    const p = page(0, 128);
    expect(p.watchers.map(([name]) => name)).toEqual(['header', 'resources']);
    p.grow(30);
    p.watchers[0]![1]();
    expect(p.props.get('--head-h')).toBe('158px');
    expect(p.props.get('--head-hide')).toBe('58px');
    p.grow(10);
    p.watchers[1]![1]();
    expect(p.props.get('--head-h')).toBe('168px');
  });

  it('marks a one-line header, and a stacked one not', () => {
    // At 1,280 px: one line of 72 px, the logo from 13, the bar from 12.
    const one = page(0, 72, [13, 46, 12]);
    expect(one.classes.get('head-line')).toBe(true);
    expect(one.props.get('--head-hide')).toBe('0px');
    expect(page(0, 128).classes.get('head-line')).toBe(false);
  });

  it('keeps the mark right when the header wraps or unwraps', () => {
    const p = page(0, 72, [13, 46, 12]);
    expect(p.classes.get('head-line')).toBe(true);
    // The line breaks: the bar moves below the logo.
    p.moveBar(68, 128);
    p.watchers[0]![1]();
    expect(p.classes.get('head-line')).toBe(false);
    expect(p.props.get('--head-hide')).toBe('59px');
    p.moveBar(12, 72);
    p.watchers[1]![1]();
    expect(p.classes.get('head-line')).toBe(true);
    expect(p.props.get('--head-hide')).toBe('0px');
  });

  it('follows the scrolling of the page, up and down', () => {
    const p = page(0, 128);
    expect(p.classes.get('scrolled')).toBe(false);
    p.scroll(1);
    expect(p.classes.get('scrolled')).toBe(true);
    p.scroll(400);
    expect(p.classes.get('scrolled')).toBe(true);
    p.scroll(0);
    expect(p.classes.get('scrolled')).toBe(false);
  });
});
