import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],
  serverExternalPackages: ["drizzle-orm", "pg", "stripe", "cloudinary"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
