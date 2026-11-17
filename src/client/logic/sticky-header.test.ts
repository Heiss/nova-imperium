import { describe, expect, it } from 'vitest';
import { headerLengths, keepHeaderInView } from './sticky-header.ts';

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

describe('keeping the header in view (#193)', () => {
  /** A page whose header starts at `top` and is `height` tall. */
  function page(top: number, height: number) {
    const box = (t: number, h: number) => ({ top: t, height: h });
    const props = new Map<string, string>();
    const watchers: [string, () => void][] = [];
    const part = (name: string, at: number, tall: number) => ({
      name,
      getBoundingClientRect: () => box(top + at, tall),
    });
    keepHeaderInView({
      header: {
        name: 'header',
        getBoundingClientRect: () => box(top, height),
      },
      logo: part('logo', 12, 46),
      resources: part('resources', 68, 47),
      setProperty: (name, value) => props.set(name, value),
      observe: (target, measure) => watchers.push([target.name, measure]),
    });
    return {
      props,
      watchers,
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
});
