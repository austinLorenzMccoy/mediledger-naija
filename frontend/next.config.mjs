/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiGateway = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const aiService  = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:3008'
    return [
      // NestJS API Gateway — auth, claims, tokens, USSD, emergency
      { source: '/api/v1/:path*', destination: `${apiGateway}/api/v1/:path*` },
      // Python AI Service — inference, insights, drug interactions
      { source: '/api/v1/ai/:path*', destination: `${aiService}/api/v1/ai/:path*` },
    ]
  },
}

export default nextConfig
