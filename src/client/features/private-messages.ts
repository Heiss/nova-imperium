// The browser side of the private messages (#226): the components of
// „Nachrichten“ own their forms and ask for an action through the event
// `pm:act` (logic/private-messages.ts); this feature sends it, asks the
// question before a deletion or a report, and answers whether it went
// through, so a form empties only then. The server checks every action.
import {
  PM_EVENT,
  questionFor,
  type PmCall,
  type PmRequest,
} from '../logic/private-messages.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

type Act = ClientCtx['act'];

/** Sends the action a component chose; the name of the call picks the type of its data. */
function send(
  act: Act,
  call: Exclude<PmCall, readonly ['olderPrivateMessages', unknown]>,
): Promise<boolean> {
  switch (call[0]) {
    case 'sendPrivateMessage':
      return act(call[0], call[1]);
    case 'readPrivateMessages':
      return act(call[0], call[1]);
    case 'deletePrivateMessage':
      return act(call[0], call[1]);
    case 'deletePrivateConversation':
      return act(call[0], call[1]);
    case 'reportPrivateMessage':
      return act(call[0], call[1]);
    case 'blockPlayer':
      return act(call[0], call[1]);
    case 'unblockPlayer':
      return act(call[0], call[1]);
    default:
      return act(call[0], call[1]);
  }
}

/** Runs one request: ask first where an action cannot be taken back, then send. */
export async function answer(
  ctx: ClientCtx,
  request: PmRequest,
  confirm: (question: string) => boolean,
): Promise<void> {
  const question = questionFor(request.call);
  if (question !== null && !confirm(question)) return request.done(false);
  const call = request.call;
  // Older messages are read, not changed: the answer's data, no new state.
  if (call[0] === 'olderPrivateMessages') {
    try {
      const answer = await ctx.api('/api/action', {
        type: call[0],
        ...call[1],
      });
      request.done(true, (answer.data ?? {}) as Record<string, unknown>);
    } catch (error) {
      ctx.toast((error as Error).message, true);
      request.done(false);
    }
    return;
  }
  request.done(await send(request.quiet ? ctx.quiet : ctx.act, call));
}

export const clientFeature = {
  listen: (ctx) => {
    document.addEventListener(PM_EVENT, (event) => {
      void answer(ctx, (event as CustomEvent<PmRequest>).detail, (q) =>
        window.confirm(q),
      );
    });
  },
  acts: () => ({}),
} satisfies ClientFeature;
