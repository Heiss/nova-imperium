// Small reads and writes of the page that main.ts and the client features
// share (#322).

/** The first element that matches. */
export const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

/** The value of a field, or the empty string while it is not there. */
export const val = (sel: string): string =>
  $<HTMLInputElement>(sel)?.value ?? '';

/** The value of a field by its id (ids of guild ranks are not CSS-safe). */
export const byId = (id: string): string =>
  (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';

/** Sets the value of a field by its id, when it is there. */
export const setById = (id: string, value: string): void => {
  const field = document.getElementById(id) as HTMLInputElement | null;
  if (field) field.value = value;
};

/**
 * The chat log keeps its place when the view renders again; at its end it
 * follows the new messages (#169).
 */
export function keepChatScroll(root: ParentNode, end = false): () => void {
  const log = root.querySelector<HTMLElement>('.chat-log');
  const atEnd =
    end || !log || log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
  const top = log?.scrollTop ?? 0;
  return () => {
    const next = root.querySelector<HTMLElement>('.chat-log');
    if (next) next.scrollTop = atEnd ? next.scrollHeight : top;
  };
}

/** Closes the sheet „Mehr“ when it is open. */
export function closeMore(): void {
  const more = $<HTMLDialogElement>('#more');
  if (more?.open) more.close();
}
