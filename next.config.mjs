/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "react-markdown",
    "remark-gfm",
    "mdast-util-to-markdown",
  ],
};

export default nextConfig;