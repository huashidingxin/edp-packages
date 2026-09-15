import { defineConfig } from 'vite'

export default defineConfig({
  // Nuxt/unimport scans workspace dist files during local development. Minified
  // identifiers can collide with Vue auto-imports (for example `h`), so keep
  // package identifiers stable while still allowing syntax/whitespace shrinking.
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        module: 'src/module.ts',
        composables: 'src/composables.ts',
        'composables/useSite': 'src/composables/useSite.ts',
        'composables/useLocale': 'src/composables/useLocale.ts',
        'composables/useLocaleLight': 'src/composables/useLocaleLight.ts',
        'composables/useT': 'src/composables/useT.ts',
        'composables/useWebReveal': 'src/composables/useWebReveal.ts',
        'lib/layoutLint': 'src/lib/layoutLint.ts',
        'lib/menus': 'src/lib/menus.ts',
        'lib/modules': 'src/lib/modules.ts',
        'lib/profile': 'src/lib/profile.ts',
        'lib/site': 'src/lib/site.ts',
        'lib/siteRequests': 'src/lib/siteRequests.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^node:/, /^nuxt(\/|$)/, /^@nuxt\//, /^@edp\//, 'vue', 'defu'],
      output: { entryFileNames: '[name].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
})
