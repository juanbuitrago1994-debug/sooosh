import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Sin el indicador circular "N" de `next dev` (los errores de compilación y de ejecución se siguen mostrando).
  devIndicators: false,
  // Librerías con workers/WASM/fuentes propias: que Node las cargue tal cual, sin empaquetarlas.
  serverExternalPackages: ["tesseract.js", "officeparser", "mammoth", "unpdf", "@napi-rs/canvas", "postgres"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
