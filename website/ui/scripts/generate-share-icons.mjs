/**
 * 重新生成 src/lib/share-icons.ts（离线图标子集）。
 *
 * 用法：在 packages/website/ui 下 `node scripts/generate-share-icons.mjs`。
 * 新增分享渠道时：在 ICONS 里补条目后重跑；不整包引入 @iconify-json/*，避免 bundle 膨胀，
 * 也避免运行时依赖 Iconify API（国内可达性）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ICONS = {
  '@iconify-json/simple-icons': ['sinaweibo', 'tencentqq', 'wechat', 'qzone', 'douban', 'linkedin'],
  '@iconify-json/lucide': ['share-2', 'link', 'check', 'qr-code'],
};

function pick(pkg, names) {
  const collection = JSON.parse(readFileSync(require.resolve(`${pkg}/icons.json`), 'utf8'));
  const out = {};
  for (const name of names) {
    let icon = collection.icons[name];
    if (!icon && collection.aliases?.[name]) icon = collection.icons[collection.aliases[name].parent];
    if (!icon) throw new Error(`icon not found: ${pkg} ${name}`);
    out[name] = {
      body: icon.body,
      width: icon.width ?? collection.width ?? 24,
      height: icon.height ?? collection.height ?? 24,
    };
  }
  return out;
}

const icons = Object.fromEntries(
  Object.entries(ICONS).flatMap(([pkg, names]) => Object.entries(pick(pkg, names))),
);

const body = `/**
 * WebShare 离线图标子集 —— 由 scripts/generate-share-icons.mjs 构建期自
 * @iconify-json/simple-icons / @iconify-json/lucide 抽取。
 * 避免整包 icons.json 进 bundle，也避免运行时依赖 Iconify API（国内可达性）。
 */

export const shareIconSet = ${JSON.stringify({ prefix: 'web-share', icons }, null, 2)}
`;
writeFileSync(new URL('../src/lib/share-icons.ts', import.meta.url), body);
console.log(`share-icons.ts regenerated: ${Object.keys(icons).length} icons`);
