// Formatting for the German interface.
import type { Coords, Levels, Resources } from '../../shared/types.ts';

export const fmt = (n: number | null | undefined): string =>
  Math.floor(n || 0).toLocaleString('de-DE');

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
/** Escapes text for HTML; everything from players or the server goes through here. */
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]!);

export const coords = (c: Coords | null | undefined): string =>
  c ? `[${c.g}:${c.s}:${c.p}]` : '[?]';

export const clampInt = (v: unknown, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

/** A duration like "1T 2h 03m 04s"; leading zero units are left out. */
export function dur(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s %= 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}T`);
  if (d || h) parts.push(`${h}h`);
  if (d || h || m) parts.push(`${String(m).padStart(d || h ? 2 : 1, '0')}m`);
  parts.push(`${String(s).padStart(2, '0')}s`);
  return parts.join(' ');
}

export const dt = (t: number): string =>
  new Date(t).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export const resLine = (r: Resources): string =>
  `Metall ${fmt(r.m)} · Kristall ${fmt(r.c)} · Deuterium ${fmt(r.d)}`;

export const techLine = (t: Levels): string =>
  `Waffen ${(t.weapons ?? 0) * 10}% · Schilde ${(t.shield ?? 0) * 10}% · Panzerung ${(t.armor ?? 0) * 10}%`;
