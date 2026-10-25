/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],
  poweredByHeader: false,
  images: { unoptimized: true },
  // "/" is the static 3D landing built by `npm run build:landing` into public/landing.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/landing/index.html" }] };
  },
};
export default nextConfig;
