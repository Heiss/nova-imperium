import { type Component, mount, unmount } from 'svelte';
import type { HeaderLine } from '../logic/header.ts';
import type { Navigation } from '../logic/navigation.ts';
import type { ResourceBar as Bar } from '../logic/resource-bar.ts';
import { keepHeaderInView } from '../logic/sticky-header.ts';
import Header from './Header.svelte';
import Menu from './Menu.svelte';
import MoreList from './MoreList.svelte';
import ResourceBar from './ResourceBar.svelte';
import TabBar from './TabBar.svelte';

// The frame around the view (#118, bundle 1; okf/architecture/patterns.md,
// section 9): the header line, the menu, on a phone the tab bar and the
// sheet „Mehr“, and the resource bar, each a Svelte component in its place
// of index.html. Each is mounted anew whenever main.ts shows it, as its
// HTML was written anew before: a link or the list „Aktiver Planet“ loses
// its focus on a render as before, and the bar is mounted anew every second.

/** The places of the frame in index.html, by id. */
const PLACES = ['pinfo', 'menu', 'tabbar', 'more-list', 'resbar'] as const;
type Place = (typeof PLACES)[number];

/** The component mounted in each place. */
const shown = new Map<Place, ReturnType<typeof mount>>();

function empty(place: Place): HTMLElement {
  const before = shown.get(place);
  if (before) void unmount(before);
  shown.delete(place);
  const target = document.getElementById(place)!;
  target.replaceChildren();
  return target;
}

function show<Props extends Record<string, unknown>>(
  place: Place,
  component: Component<Props>,
  props: Props,
): void {
  shown.set(place, mount(component, { target: empty(place), props }));
}

/** The header line of the shown place. */
export function showHeader(line: HeaderLine): void {
  watchHeader();
  show('pinfo', Header, { line });
}

/** The menu, the tab bar and the list of „Mehr“. */
export function showNavigation(nav: Navigation): void {
  show('menu', Menu, { nav });
  show('tabbar', TabBar, { nav });
  show('more-list', MoreList, { nav });
}

/** The resource bar. */
export const showResourceBar = (bar: Bar): void =>
  show('resbar', ResourceBar, { bar });

/** Signed out: the frame is empty. */
export function clearFrame(): void {
  for (const place of PLACES) empty(place);
}

let watching = false;

// The header and the side menu stay in view while the page scrolls (#193):
// the CSS gets the lengths of the header from keepHeaderInView() of
// logic/sticky-header.ts, measured at the first header shown and whenever the
// header or the resource bar changes size. Started here, not when the module
// loads, so a test can import the frame without a page.
function watchHeader(): void {
  if (watching) return;
  watching = true;
  keepHeaderInView({
    header: document.querySelector('header')!,
    logo: document.querySelector<HTMLElement>('header .logo')!,
    resources: document.getElementById('resbar')!,
    setProperty: (name, value) =>
      document.documentElement.style.setProperty(name, value),
    observe: (target, measure) => new ResizeObserver(measure).observe(target),
    toggle: (name, on) => document.documentElement.classList.toggle(name, on),
    scrolled: () => window.scrollY > 0,
    onScroll: (listener) =>
      window.addEventListener('scroll', listener, { passive: true }),
  });
}
