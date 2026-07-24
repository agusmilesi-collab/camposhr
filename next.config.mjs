/** @type {import('next').NextConfig} */
const nextConfig = {
  // El sitio de herramientas vive en /public con URLs limpias.
  // Estos rewrites mapean esas rutas al archivo estatico correspondiente.
  rewrites: async () => [
    { source: '/test-rorschach', destination: '/test-rorschach/index.html' },
    { source: '/test-rorschach/', destination: '/test-rorschach/index.html' },
    { source: '/test-zulliger', destination: '/test-zulliger/index.html' },
    { source: '/test-zulliger/', destination: '/test-zulliger/index.html' },
  ],
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
};
export default nextConfig;
