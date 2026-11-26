// The code of a sign-in mail (#401): the browser and the server count the
// same 30 s before „Code erneut senden“.

/** „Code erneut senden“ comes after 30 s, and a new code is sent once in 30 s (owner, 2026-11-25, 101b). */
export const RESEND_AFTER = 30_000;
