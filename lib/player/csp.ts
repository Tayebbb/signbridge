/** Measured by T23. Only the isolated renderer receives these permissions. */
export const rendererCsp = [
  "default-src 'none'",
  "script-src 'self' https://vhg.cmp.uea.ac.uk",
  "script-src-attr 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://vhg.cmp.uea.ac.uk",
  "connect-src 'self' https://vhg.cmp.uea.ac.uk",
  "img-src https://vhg.cmp.uea.ac.uk blob: data:",
  "worker-src blob:",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'",
].join("; ");
