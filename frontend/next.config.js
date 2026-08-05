/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async redirects() {
    return [
      // Cutover to the new design system — ONLY for routes where full
      // functional parity with the old page was confirmed first (see
      // company-admin-v2/dash and .../roles: both now include every
      // widget/action the old pages had, not a subset). Super Admin
      // dashboard is deliberately NOT redirected yet — its MRR/ARR
      // metrics need a dedicated merge pass before cutover, same
      // standard applied here.
      { source: '/company-admin/dashboard', destination: '/company-admin-v2/dash', permanent: false },
      { source: '/company-admin/roles', destination: '/company-admin-v2/roles', permanent: false },
    ];
  },
};
module.exports = nextConfig;
