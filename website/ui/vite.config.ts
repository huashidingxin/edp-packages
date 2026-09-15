import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * @edp/website-ui 构建配置。
 *
 * 库模式多入口：src/index.ts 为统一出口，各子模块（api/auth/contracts/lib/blocks）
 * 经 re-export 在 index.js 聚合，同时保留子路径 ./blocks/*、./client、./contracts 等出口
 * （见 package.json exports）以便站点按需 import。
 *
 * 产物结构由 copy-package-assets.mjs 二次整理：src/{blocks,styles.css} 原样拷贝到 dist
 * 并把 .ts 相对引用改写为 .js，故 dist/blocks/*.vue 为源码直拷（站点经 noExternal 由
 * Nuxt/Vite 编译 .vue）。
 *
 * 注意：minifyIdentifiers 必须关闭（与 runtime 一致）—— unimport 扫描 dist 时，
 * 压缩标识符会与 Vue auto-import 碰撞（如 `h`）。
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
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
        'api/client': 'src/api/client.ts',
        'api/auth': 'src/api/auth.ts',
        'api/theme': 'src/api/theme.ts',
        'api/navigation': 'src/api/navigation.ts',
        'contracts/index': 'src/contracts/index.ts',
        'auth/session': 'src/auth/session.ts',
        'lib/cn': 'src/lib/cn.ts',
        'lib/ui': 'src/lib/ui.ts',
        'lib/nav': 'src/lib/nav.ts',
        'lib/form': 'src/lib/form.ts',
        'lib/chat': 'src/lib/chat.ts',
        'lib/chatStore': 'src/lib/chatStore.ts',
        'lib/media': 'src/lib/media.ts',
        'lib/lightbox': 'src/lib/lightbox.ts',
        'lib/share': 'src/lib/share.ts',
        'lib/share-icons': 'src/lib/share-icons.ts',
        'lib/about': 'src/lib/about.ts',
        'lib/carousel': 'src/lib/carousel.ts',
        'lib/rules': 'src/lib/rules.ts',
        'lib/qr': 'src/lib/qr.ts',
        'blocks/index': 'src/blocks/index.ts',
        'componentStrings': 'src/componentStrings.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', /^@edp\//, 'clsx', 'tailwind-merge', 'class-variance-authority', 'reka-ui', '@iconify/vue', '@lucide/vue', 'qrcode-generator', /^@iconify-json\//, /^node:/],
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
