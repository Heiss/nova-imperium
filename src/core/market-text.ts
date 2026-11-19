// The German words of the marketplace that the server and the browser say
// the same (#171, okf/features/marketplace.md): the refusal of an exchange
// by its code, and what a finished exchange says. Taken from the issue where
// it has them („Der Marktplatz ist in dieser Runde geschlossen.“); every
// other text is a draft [V] for the owner to confirm in the pull request.
import {
  type Market,
  type Quote,
  RES_NAME,
  type Res,
  type TradeError,
  remaining,
} from './market.ts';

/** A German number: 12345 → „12.345“. */
const de = (n: number): string => n.toLocaleString('de-DE');

/** The name of a resource by its letter. */
const nameOf = (res: unknown): string => RES_NAME[res as Res];

/** The refusal in a round with the marketplace off (the issue, [V]). */
export const CLOSED = 'Der Marktplatz ist in dieser Runde geschlossen.';

/** The note of each refusal; `get` is the resource asked for, `m` the market it was asked on. */
const NOTES: Readonly<
  Record<
    TradeError,
    (m: Pick<Market, 'used' | 'limit'>, get: unknown) => string
  >
> = {
  closed: () => CLOSED,
  noPost: () => 'Auf diesem Planeten fehlt ein Handelsposten.',
  resource: () => 'Diese Rohstoffe lassen sich nicht tauschen.',
  amount: () => 'Bitte eine ganze Menge von mindestens 1 angeben.',
  poor: () => 'So viel hast du auf diesem Planeten nicht.',
  full: (_, get) => `Das Lager für ${nameOf(get)} ist voll.`,
  limit: (m) =>
    `Tageslimit erreicht: Heute kannst du noch ${de(remaining(m))} tauschen.`,
  tiny: () => 'Für diese Menge bekommst du nichts.',
};

/** The note of a refusal. */
export const tradeNote = (
  error: TradeError,
  m: Pick<Market, 'used' | 'limit'>,
  get: unknown,
): string => NOTES[error](m, get);

/**
 * What a finished exchange says; a capped one also says that the storage is
 * full now, one that the limit of the day cut says so (owner, 2026-11-19,
 * wording [V]).
 */
export function tradeDone(q: Quote): string {
  const [give, get] = [nameOf(q.pair[0]), nameOf(q.pair[1])];
  const done = `${de(q.given)} ${give} gegen ${de(q.got)} ${get} getauscht.`;
  if (q.cut)
    return `${done} Tageslimit erreicht: Es wurden nur ${de(q.given)} ${give} getauscht.`;
  return q.capped ? `${done} Das Lager für ${get} ist jetzt voll.` : done;
}
