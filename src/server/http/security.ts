// Security headers. Caddy sets the same Content-Security-Policy in front of the
// server (docker/Caddyfile); a unit test keeps both equal. The server sets them
// as well, so a run without Caddy (tests, development) is just as strict.

/** No inline scripts or styles; the SVG art is embedded as data: images. */
export const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};
