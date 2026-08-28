/** @type {import('next').NextConfig} */
const nextConfig = {
  // El lector de PDF corre en Node y trae su propio worker en un archivo
  // aparte. Empaquetado por Next, ese archivo no queda donde la librería lo
  // busca y la lectura falla; declarado como externo se carga desde
  // node_modules, que es donde está.
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  // Los documentos de los clientes se leen del disco en tiempo de pedido y no
  // están en /public, así que hay que decirle a Next que los suba: lo que no
  // se importa desde el código no viaja al paquete de la función.
  outputFileTracingIncludes: {
    '/p/[token]/doc/[archivo]': ['./documentos/**/*'],
    '/p/[token]/informe/[id]': ['./documentos/**/*'],
    // Y el worker del lector de PDF, por la misma razón: pdfjs lo carga en
    // tiempo de ejecución armando la ruta con una cadena, así que el rastreo de
    // Next no lo ve y no lo sube. En el servidor de desarrollo está porque se
    // lee de node_modules; en la función desplegada faltaba, y la lectura moría
    // con "Setting up fake worker failed". Rompía los tres lugares que leen un
    // PDF: el informe del Benziger y el CV, del portal y del OS.
    '/api/os/benziger': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    '/api/os/cv': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    '/api/portal/cv': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
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
