import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],
  serverExternalPackages: ["drizzle-orm", "pg", "stripe", "cloudinary"],
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Hosts such as Render report dozens of CPUs and Next would start that many
    // build workers, each holding its own memory ("Ran out of memory" while
    // collecting page data). A few workers are plenty for this app.
    cpus: 2,
  },
  async redirects() {
    // Familiar WooCommerce-style account URLs land on the storefront account.
    return [
      { source: "/my-account", destination: "/home/account", permanent: false },
      { source: "/my-account/:path*", destination: "/home/account/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
