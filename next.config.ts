import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds a
  // package-lock.json in the home directory, then warns that it is outside
  // the repo and ignores it.
  turbopack: { root: __dirname },
};

export default nextConfig;
