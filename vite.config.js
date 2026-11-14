import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/exporters/GLTFExporter.js',
      'three/examples/jsm/utils/BufferGeometryUtils.js'
    ]
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 }
});