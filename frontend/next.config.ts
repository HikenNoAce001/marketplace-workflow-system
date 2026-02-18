import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // "standalone" bundles everything into .next/standalone for Docker
  // This eliminates the need for node_modules in the final image
  output: "standalone",
};

export default nextConfig;
