import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Mapbox GL needs its API/tile hosts plus blob: workers and images
// (https://docs.mapbox.com/mapbox-gl-js/guides/browsers-and-testing/#csp-directives).
// Next.js inlines its bootstrap scripts, hence 'unsafe-inline' for scripts;
// React dev tooling additionally needs 'unsafe-eval' in development only.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://api.mapbox.com",
  "font-src 'self'",
  "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
  "worker-src 'self' blob:",
  "child-src blob:",
  "media-src 'self' blob: mediastream:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking: nobody may frame Pulse (and trick users into granting
  // camera/mic/location to a hidden iframe).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  // Only Pulse itself may ask for these; everything else is off.
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
