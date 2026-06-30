import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Serve the static pitch deck (frontend/public/deck/) at /deck
      { source: "/deck", destination: "/deck/index.html" },
    ];
  },
};

export default nextConfig;
