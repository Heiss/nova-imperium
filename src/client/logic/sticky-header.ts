// The header with the resources and the side menu stay in view while the
// page scrolls (#193). On the desktop the header sticks with its logo line
// above the top of the screen, so it gets slimmer while scrolled and is full
// again at the top; the menu sticks right below what stays of it. The CSS
// (style.css, „Sticky header“) needs two lengths that depend on how the
// header wraps, so they are measured here and set as custom properties:
// --head-h, the full height of the header, and --head-hide, how much of it
// goes above the screen (the logo line). The keyboard focus keeps clear of
// the header through scroll-padding-top, from the same lengths. Two classes
// of <html> tell the CSS the rest: `head-line` (the header is one line, the
// logo beside the resources) and `scrolled` (the page is not at its top); on
// a one-line header the logo becomes smaller while scrolled (owner,
// 2026-11-17).

/** Where the parts of the header are, in CSS pixels, from its top. */
interface HeaderBox {
  /** The full height of the header, its border included. */
  height: number;
  /** The bottom of the logo. */
  logoBottom: number;
  /** The top of the resource bar. */
  resourcesTop: number;
}

/** The logo has a line of its own above the resources. */
export const stacked = (box: HeaderBox): boolean =>
  box.logoBottom <= box.resourcesTop;

/**
 * The custom properties of the header. When the logo has a line of its own
 * above the resources, everything down to the bottom of the logo goes above
 * the screen, so the resources keep the space between the lines; when the
 * logo stands beside the resources, the header is one line and nothing goes.
 */
export function headerLengths(box: HeaderBox): Record<string, string> {
  const hide = stacked(box) ? box.logoBottom : 0;
  return {
    '--head-h': `${Math.round(box.height)}px`,
    '--head-hide': `${Math.round(hide)}px`,
  };
}

/** The part of the DOM the header needs: a structural subset of Element. */
interface Measured {
  getBoundingClientRect(): { top: number; height: number };
}

/** What keepHeaderInView() uses of the page; the browser's in main use. */
interface HeaderPage<E extends Measured> {
  header: E;
  logo: E;
  resources: E;
  setProperty: (name: string, value: string) => void;
  observe: (target: E, measure: () => void) => void;
  /** Sets or clears a class of the page. */
  toggle: (name: string, on: boolean) => void;
  /** The page is scrolled away from its top. */
  scrolled: () => boolean;
  onScroll: (listener: () => void) => void;
}

/** Measures the header now and again whenever it or the bar changes size. */
export function keepHeaderInView<E extends Measured>(
  page: HeaderPage<E>,
): void {
  const measure = (): void => {
    const head = page.header.getBoundingClientRect();
    const logo = page.logo.getBoundingClientRect();
    const box = {
      height: head.height,
      logoBottom: logo.top + logo.height - head.top,
      resourcesTop: page.resources.getBoundingClientRect().top - head.top,
    };
    for (const [name, value] of Object.entries(headerLengths(box)))
      page.setProperty(name, value);
    page.toggle('head-line', !stacked(box));
  };
  const mark = (): void => page.toggle('scrolled', page.scrolled());
  mark();
  page.onScroll(mark);
  measure();
  page.observe(page.header, measure);
  page.observe(page.resources, measure);
}
