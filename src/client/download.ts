// The download of the errors of the admin (issue #126; #118, after bundle 7;
// formerly in views/admin-errors.ts).

/**
 * Saves the ZIP the server answers with, under the name it gives. A lost
 * session (401) goes to `signedOut`, the same way as every other call.
 */
export async function downloadErrors(
  body: object,
  signedOut: (error: unknown) => never,
): Promise<void> {
  const r = await fetch('/api/admin/errors/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.status === 401) signedOut(j.error);
    throw new Error(j.error ?? 'Der Download ist fehlgeschlagen.');
  }
  const header = r.headers.get('content-disposition') ?? '';
  const name =
    /filename="([^"]+)"/.exec(header)?.[1] ?? 'nova-imperium-fehler.zip';
  const url = URL.createObjectURL(await r.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
