/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // UI-only showcase: don't let lint stylistics block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
