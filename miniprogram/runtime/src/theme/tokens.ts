/**
 * 品牌令牌（纯逻辑，node:test 覆盖；不含 vue，故可独立测试）。
 * 语义色名与 web 侧 `--color-*` 对齐，两端共用设计稿。
 */

export interface ThemeTokens {
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  background: string
  foreground: string
  card: string
  cardForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  destructive: string
  destructiveForeground: string
  radiusCard: string
  radiusMd: string
  fontSans: string
  pagePaddingX: string
  sectionPy: string
  navbarHeight: string
  tabbarHeight: string
}

export const defaultTokens: ThemeTokens = {
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  secondary: '#f4f6fb',
  secondaryForeground: '#0b1220',
  background: '#ffffff',
  foreground: '#0b1220',
  card: '#ffffff',
  cardForeground: '#0b1220',
  muted: '#f4f6fb',
  mutedForeground: '#5a6577',
  accent: '#eef4ff',
  accentForeground: '#1e40af',
  border: '#e6e9f0',
  input: '#dce1ea',
  ring: '#2563eb',
  destructive: '#e11d48',
  destructiveForeground: '#ffffff',
  radiusCard: '16rpx',
  radiusMd: '12rpx',
  fontSans: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  pagePaddingX: '32rpx',
  sectionPy: '56rpx',
  navbarHeight: '88rpx',
  tabbarHeight: '100rpx',
}

/** 令牌 → 页面根节点 CSS 变量。 */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--color-primary': tokens.primary,
    '--color-primary-foreground': tokens.primaryForeground,
    '--color-secondary': tokens.secondary,
    '--color-secondary-foreground': tokens.secondaryForeground,
    '--color-background': tokens.background,
    '--color-foreground': tokens.foreground,
    '--color-card': tokens.card,
    '--color-card-foreground': tokens.cardForeground,
    '--color-muted': tokens.muted,
    '--color-muted-foreground': tokens.mutedForeground,
    '--color-accent': tokens.accent,
    '--color-accent-foreground': tokens.accentForeground,
    '--color-border': tokens.border,
    '--color-input': tokens.input,
    '--color-ring': tokens.ring,
    '--color-destructive': tokens.destructive,
    '--color-destructive-foreground': tokens.destructiveForeground,
    '--radius-card': tokens.radiusCard,
    '--radius-md': tokens.radiusMd,
    '--font-sans': tokens.fontSans,
    '--mp-page-px': tokens.pagePaddingX,
    '--mp-section-py': tokens.sectionPy,
    '--mp-navbar-h': tokens.navbarHeight,
    '--mp-tabbar-h': tokens.tabbarHeight,
  }
}

/** 令牌 → uview 色板。只映射品牌项，`success/warning/error/info` 保留 uview 默认。 */
export function tokensToUpColorMap(tokens: ThemeTokens): Record<string, string> {
  return {
    'up-primary': tokens.primary,
    'up-primary-light': tokens.accent,
    'up-main-color': tokens.foreground,
    'up-content-color': tokens.mutedForeground,
    'up-tips-color': tokens.mutedForeground,
    'up-border-color': tokens.border,
    'up-bg-color': tokens.muted,
    'up-card-bg-color': tokens.card,
    'up-page-bg-color': tokens.background,
    'up-navbar-bg-color': tokens.card,
    'up-disabled-color': tokens.mutedForeground,
  }
}
