/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "leadreply-production.up.railway.app"],
    },
  },
}

module.exports = nextConfig
