import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to the dashboard directory. Without this,
  // Next 16 walks up looking for a lockfile and lands on the monorepo root
  // (/goldenbook/package-lock.json) — which makes Turbopack watch the whole
  // repo and emit the "inferred workspace root" warning on every dev start.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      // Untransformed object URLs (kept for backward-compatible call sites
      // that haven't migrated to variants yet).
      {
        protocol: "https",
        hostname: "ltdhyshuhkvicsvtssjm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase Image Transformation API — used by getStorageUrl when a
      // variant is requested. Returns CDN-cacheable derivatives with
      // Cache-Control: max-age=31536000.
      {
        protocol: "https",
        hostname: "ltdhyshuhkvicsvtssjm.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
  },
};

export default nextConfig;