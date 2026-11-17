import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  agentRules: false,
  images: {
    qualities: [75, 100],
  },
  serverExternalPackages: ['ali-oss'],
}

export default nextConfig
