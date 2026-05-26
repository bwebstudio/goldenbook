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
      {
        protocol: "https",
        hostname: "ltdhyshuhkvicsvtssjm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;