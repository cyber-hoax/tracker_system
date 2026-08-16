import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres", "gray-matter", "leetcode-query"],
  devIndicators: false,
};

export default nextConfig;
