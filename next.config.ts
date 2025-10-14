import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mastra/*'],
  // Vercel環境での互換性向上
  experimental: {
    serverComponentsExternalPackages: ['@mastra/core', '@mastra/libsql', '@mastra/loggers', '@mastra/memory', '@mastra/voice-google'],
  },
  // API routes の設定
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
