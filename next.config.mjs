/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/analyze-contract",
        destination: "/api/analyze-contract"
      }
    ];
  }
};

export default nextConfig;
