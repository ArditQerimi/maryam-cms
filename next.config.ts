import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],
  serverExternalPackages: ["drizzle-orm", "pg", "stripe", "cloudinary"],
  turbopack: {
    root: process.cwd(),
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
