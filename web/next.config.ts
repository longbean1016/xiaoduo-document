import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  agentRules: false,
  serverExternalPackages: ['ali-oss'],
}

export default nextConfig
