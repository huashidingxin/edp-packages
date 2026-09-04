import { access, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  ['website/ui', ['src/styles.css', 'src/blocks']],
  ['website/runtime', ['src/pages', 'src/layouts', 'src/components', 'src/app.vue', 'src/plugin.site.ts', 'src/router.options.ts', 'src/env.d.ts']],
]

async function rewriteRelativeSpecifiers(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) await rewriteRelativeSpecifiers(path)
    if (entry.isFile() && (entry.name.endsWith('.d.ts') || entry.name.endsWith('.vue') || entry.name.endsWith('.ts'))) {
      const source = await readFile(path, 'utf8')
      await writeFile(path, source.replace(/(['\"])(\.\.?\/[^'\"]+)\.ts\1/g, '$1$2.js$1'))
    }
  }
}

for (const [relative, entries] of targets) {
  const sourceRoot = resolve(root, relative)
  const outputRoot = resolve(sourceRoot, 'dist')
  for (const entry of entries) {
    const source = resolve(sourceRoot, entry)
    const target = resolve(outputRoot, entry.replace(/^src\/?/, ''))
    try {
      await access(source)
    } catch {
      continue
    }
    await mkdir(dirname(target), { recursive: true })
    await cp(source, target, { recursive: true, force: true })
  }

  await rewriteRelativeSpecifiers(outputRoot)
}
