const nextConfig = {
  output: 'standalone',
  // NOTE: turbopack removed — project always uses --webpack (Turbopack causes
  // Compaction failed crashes on this codebase. Never re-enable.)
  images: {
    unoptimized: true,
  },
  experimental: {
    // Remove if not using Server Components
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  // Keep pages/chunks warm longer so the dev server doesn't evict and
  // attempt a concurrent re-compile that produces empty JSON manifests.
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 60 seconds (was 10s — too aggressive)
    pagesBufferLength: 5,       // keep 5 pages in memory (was 2)
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
