import type { NextConfig } from "next";

// Baseline security headers for every route. A full script CSP would need
// per-request nonces, which forces every page to render dynamically (no
// Partial Prerendering), so only frame-ancestors is set.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Self-contained server for Docker/VPS (scripts/start-standalone.mjs). Vercel ignores it.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Room for 2 MB wager uploads in the admin panel.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
