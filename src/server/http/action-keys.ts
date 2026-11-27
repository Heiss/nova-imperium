// A repeated action runs once (#450, owner, 2026-11-27, 292a; the shape is
// [V]): the browser sends a key with every action, once per click or submit,
// in the header `Idempotency-Key`. The server keeps the outcome of each key
// per player for a short time in memory, and a request with a key it has
// already run gets the outcome of the first run without running again. A
// request without a key, or with an invalid one, runs as before (the
// transition; #408 makes the key required). Only outcomes that are final are
// kept: an answer, or a refusal of the game. A busy database, a server
// error, a missing session and every other failure are forgotten, so a
// resend runs again.
import type { IncomingMessage } from 'node:http';
import { GameError } from '../game/context.ts';
import type { Reply } from './app.ts';

/** The header of the key; Node gives header names in lower case. */
const KEY_HEADER = 'idempotency-key';

/** How long a key is kept, in milliseconds (60 s, [V]). */
export const KEPT_MS = 60_000;

/** The keys kept per player at most; the oldest goes first ([V]). */
export const KEYS_PER_PLAYER = 50;

/** A key as the browser makes it: `crypto.randomUUID()`, or up to 64 such characters. */
const VALID = /^[A-Za-z0-9-]{1,64}$/;

/** The key of a request, or null without a valid one. */
export function keyOf(req: Pick<IncomingMessage, 'headers'>): string | null {
  const key = req.headers[KEY_HEADER];
  return typeof key === 'string' && VALID.test(key) ? key : null;
}

/** What a run ended with: its answer, or the error it threw. */
type Outcome = { reply: Reply } | { error: unknown };

interface Kept {
  at: number;
  outcome: Outcome | Promise<Outcome>;
}

/** Whether an outcome is final, so a repeat may get it again. */
const final = (o: Outcome): boolean =>
  'reply' in o ? (o.reply.status ?? 200) < 500 : o.error instanceof GameError;

/** The answer of an outcome, or its error thrown again. */
function unwrap(o: Outcome): Reply {
  if ('reply' in o) return o.reply;
  throw o.error;
}

/**
 * The answer of a repeat with the state of now (#450, 4A): the outcome is
 * the first run's, but the browser never gets an older state than it has.
 */
export function freshState(reply: Reply, state: () => unknown): Reply {
  const body = reply.json as Record<string, unknown> | undefined;
  return body && 'state' in body
    ? { ...reply, json: { ...body, state: state() } }
    : reply;
}

export interface ActionKeys {
  /**
   * Runs `run` for the player's key once: a repeat of a kept key gets the
   * outcome of the first run, `fresh` given the chance to renew its answer
   * (the state of the game). Without a key it just runs.
   */
  once(
    player: string,
    key: string | null,
    run: () => Reply | Promise<Reply>,
    fresh?: (reply: Reply) => Reply,
  ): Reply | Promise<Reply>;
  /** Forgets the keys older than their time, of every player. */
  sweep(): void;
}

/** The kept keys of every player, with the clock. */
interface Store {
  players: Map<string, Map<string, Kept>>;
  now: () => number;
}

/** The player's keys still in their time; the older ones are dropped. */
function keysOf(store: Store, player: string): Map<string, Kept> {
  const keys = store.players.get(player) ?? new Map<string, Kept>();
  const oldest = store.now() - KEPT_MS;
  for (const [key, kept] of keys) if (kept.at <= oldest) keys.delete(key);
  store.players.set(player, keys);
  return keys;
}

function keep(store: Store, player: string, key: string, kept: Kept): void {
  const keys = keysOf(store, player);
  keys.set(key, kept);
  for (const old of keys.keys()) {
    if (keys.size <= KEYS_PER_PLAYER) break;
    keys.delete(old);
  }
}

function forget(store: Store, player: string, key: string, kept: Kept): void {
  const keys = store.players.get(player);
  if (keys?.get(key) === kept) keys.delete(key);
}

function replay(
  outcome: Outcome | Promise<Outcome>,
  fresh: (reply: Reply) => Reply,
): Reply | Promise<Reply> {
  if (outcome instanceof Promise) return outcome.then((o) => fresh(unwrap(o)));
  return fresh(unwrap(outcome));
}

/** The first run of a key: its outcome is kept when it is final. */
function first(
  store: Store,
  player: string,
  key: string,
  run: () => Reply | Promise<Reply>,
): Reply | Promise<Reply> {
  let result: Reply | Promise<Reply>;
  try {
    result = run();
  } catch (error) {
    const outcome = { error };
    if (final(outcome)) keep(store, player, key, { at: store.now(), outcome });
    throw error;
  }
  if (!(result instanceof Promise)) {
    const outcome = { reply: result };
    if (final(outcome)) keep(store, player, key, { at: store.now(), outcome });
    return result;
  }
  // A run that awaits (the mail of an invitation): a repeat meanwhile waits
  // for it, and a run that ends without a final outcome is forgotten.
  const pending = result.then(
    (reply): Outcome => ({ reply }),
    (error: unknown): Outcome => ({ error }),
  );
  const kept: Kept = { at: store.now(), outcome: pending };
  keep(store, player, key, kept);
  return pending.then((o) => {
    if (final(o)) kept.outcome = o;
    else forget(store, player, key, kept);
    return unwrap(o);
  });
}

export function actionKeys(now: () => number): ActionKeys {
  const store: Store = { players: new Map(), now };
  return {
    once(player, key, run, fresh = (reply) => reply) {
      if (key === null) return run();
      const kept = keysOf(store, player).get(key);
      return kept
        ? replay(kept.outcome, fresh)
        : first(store, player, key, run);
    },
    sweep() {
      for (const [player, keys] of store.players) {
        keysOf(store, player);
        if (keys.size === 0) store.players.delete(player);
      }
    },
  };
}
