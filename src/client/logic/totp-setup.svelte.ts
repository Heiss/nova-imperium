// The setup of the authenticator app under way (#401): what the server gave
// once at „Einrichten“, the address of the QR code and the secret, kept in
// this page only until the first code confirms it or the page goes.
import qrcode from 'qrcode-generator';

export const totpSetup: { uri: string | null; secret: string | null } = $state({
  uri: null,
  secret: null,
});

/** Forgets the setup under way. */
export function endTotpSetup(): void {
  totpSetup.uri = null;
  totpSetup.secret = null;
}

/**
 * The dark modules of the QR code of `text`, row by row, drawn as an SVG by
 * the box, without HTML from the library.
 */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
}
