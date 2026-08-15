import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "gray-matter", "leetcode-query"],
};

export default nextConfig;
