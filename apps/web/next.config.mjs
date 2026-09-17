/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stadia/types", "@stadia/utils"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.cloudflare.com" },
    ],
  },
};

export default nextConfig;
