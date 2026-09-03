import type { ThemeInfo, ThemeTokens } from '../contracts/index.ts';

/**
 * 把后端 theme_tokens 编译为 `:root { --token-key: value; ... }` 形式。
 *
 * 命名规则：
 * - `color.background` -> `--color-background`
 * - `background` / `primary` / `foreground` / `border` / `ring` / `muted` / `accent` / `radius`
 *   -> `--color-{key}` / `--radius-{key}`（shadcn 语义色直接走 `--color-*`）
 * - `font.sans` -> `--font-sans`、`fontSize.h1` -> `--font-size-h1`、
 *   `spacing.section` -> `--spacing-section`、`shadow.card` -> `--shadow-card` 等
 * - 顶层不匹配任何命名空间的 key（如 `radius` → `--color-radius`？）按 substring 处理：
 *   `radius` 不在已知命名空间时优先按 shadcn 的 `--radius`（不带后缀），其他未知顶层键
 *   作为 `--color-{key}` 输出，向后兼容。
 *
 * 输出始终是合法 CSS 文本（已是相对值或绝对值）。已存在的 `--color-*` 变量会被覆盖。
 */
export function tokensToCssVariables(tokens: ThemeTokens | null | undefined): string {
  if (!tokens) return '';
  const lines: string[] = [':root {'];

  // 1. shadcn 语义色 + 设计 token namespace
  for (const [key, value] of Object.entries(tokens)) {
    if (key === 'color' || key === 'colors') {
      const map = value as Record<string, string> | undefined;
      if (!map) continue;
      for (const [k, v] of Object.entries(map)) {
        if (typeof v !== 'string') continue;
        lines.push(`  --color-${k}: ${v};`);
      }
      continue;
    }
    if (key === 'radius') {
      const map = value as Record<string, string> | undefined;
      if (map && typeof map === 'object') {
        for (const [k, v] of Object.entries(map)) {
          if (typeof v !== 'string') continue;
          lines.push(`  --radius-${k}: ${v};`);
        }
      } else if (typeof value === 'string') {
        lines.push(`  --radius: ${value};`);
      }
      continue;
    }
    if (key === 'shadow') {
      const map = value as Record<string, string> | undefined;
      if (map && typeof map === 'object') {
        for (const [k, v] of Object.entries(map)) {
          if (typeof v !== 'string') continue;
          lines.push(`  --shadow-${k}: ${v};`);
        }
      }
      continue;
    }
    if (key === 'font' || key === 'fontSize' || key === 'spacing' || key === 'sizing' || key === 'lineHeight' || key === 'letterSpacing' || key === 'ratio' || key === 'container') {
      const prefix = key === 'fontSize' ? 'font-size' : key === 'lineHeight' ? 'line-height' : key === 'letterSpacing' ? 'letter-spacing' : key;
      const map = value as Record<string, string> | undefined;
      if (map && typeof map === 'object') {
        for (const [k, v] of Object.entries(map)) {
          if (typeof v !== 'string') continue;
          lines.push(`  --${prefix}-${k}: ${v};`);
        }
      }
      continue;
    }
    // 顶层 shadcn 语义色 key（直接 string）：background / foreground / primary / muted / border / ring / accent / destructive / radius
    if (typeof value === 'string') {
      // 这些键作为 shadcn 语义色
      const shadcnColorKeys = new Set([
        'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
        'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
        'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
      ]);
      if (shadcnColorKeys.has(key)) {
        lines.push(`  --color-${key}: ${value};`);
        continue;
      }
      if (key === 'radius') {
        lines.push(`  --radius: ${value};`);
        continue;
      }
      // 其他顶层未知键：默认作为 color
      lines.push(`  --color-${key}: ${value};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

/** 把后端 theme.stylesheet 解析为 { inline?, url? }，供 Nuxt useHead 使用。 */
export function resolveStylesheet(theme?: ThemeInfo | null): { inline?: string; url?: string } {
  if (!theme || !theme.stylesheet) return {};
  const { url, inline } = theme.stylesheet;
  if (url && typeof url === 'string') return { url };
  if (inline && typeof inline === 'string') return { inline };
  return {};
}
