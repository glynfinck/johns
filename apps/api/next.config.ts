import type { NextConfig } from "next";

/**
 * Headers every response gets. As in Pub Golf, the CSP carries only
 * `frame-ancestors`: a full script policy needs per-request nonces and is
 * its own change, shipped report-only first.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A join link carries the house's code; other sites get the bare origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Photo receipts use a file input, which needs no camera permission.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // The service worker must never be served stale, or a fix to push
      // handling would take days to reach phones.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
