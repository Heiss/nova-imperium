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

/**
 * Sets the value of a field of the page from the code (a button fills it): the
 * one function that writes a field (src/test/field-writes.test.ts). Only for a
 * field that holds its value in the page, such as the amounts of the lists and
 * the settings of the universe; a field of a form with state is written
 * through that state (#332), which the component shows.
 */
export function setField(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
): void {
  el.value = value;
}

/** Sets the value of a field by its id, when it is there. */
export const setById = (id: string, value: string): void => {
  const field = document.getElementById(id) as HTMLInputElement | null;
  if (field) setField(field, value);
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
