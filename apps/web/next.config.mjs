/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@office/shared-config',
    '@office/shared-domain',
    '@office/shared-events',
    '@office/shared-prompts',
    '@office/shared-types',
  ],
};

export default nextConfig;
