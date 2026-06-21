import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // 便于 Docker 部署
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
