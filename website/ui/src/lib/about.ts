/**
 * WebAbout 纯逻辑 —— 变体/尺寸到样式类的映射 + 内容归一化（node:test 覆盖）。
 *
 * 定制约定：模板内的布局常量一律写作 `var(--web-about-*, 兜底值)`，
 * 站点在任意祖先节点声明同名变量即可整站改写（也可走 props.class / 插槽逃生口）。
 */
import { cn } from './cn.ts';

export type WebAboutVariant = 'narrative' | 'split' | 'timeline';
export type WebAboutSize = 'sm' | 'md' | 'lg';
export type WebAboutAlign = 'left' | 'center';
/** split 形态下媒体落在哪一列（lg 断点生效）。 */
export type WebAboutMediaSide = 'start' | 'end';
/** 特性卡列数（窄屏恒 1 列）。 */
export type WebAboutColumns = 2 | 3 | 4;

export interface WebAboutFeature {
  title: string;
  summary?: string | null;
  /** 卡片角标：序号缺省用 01/02…，传值则显示该值（emoji / 短标签）。 */
  icon?: string | null;
  href?: string | null;
}

export interface WebAboutStat {
  value: string;
  label?: string | null;
}

export interface WebAboutMilestone {
  title: string;
  summary?: string | null;
  year?: string | null;
}

/** 标题字号阶（站点可直接改 --text-display-* 令牌整档换掉）。 */
export const ABOUT_TITLE_CLASS: Record<WebAboutSize, string> = {
  sm: 'text-display-sm',
  md: 'text-display-md',
  lg: 'text-display-lg',
};

/** 头部下间距（--web-about-head-mb 可覆盖）。 */
export const ABOUT_HEAD_MB: Record<WebAboutSize, string> = {
  sm: 'mb-[var(--web-about-head-mb,1.75rem)]',
  md: 'mb-[var(--web-about-head-mb,2.75rem)]',
  lg: 'mb-[var(--web-about-head-mb,3.5rem)]',
};

/** 主区媒体比例（--web-about-media-ratio 可覆盖）。 */
export const ABOUT_MEDIA_RATIO: Record<WebAboutVariant, string> = {
  narrative: 'aspect-[var(--web-about-media-ratio,21/9)]',
  split: 'aspect-[var(--web-about-media-ratio,4/3)]',
  timeline: 'aspect-[var(--web-about-media-ratio,4/3)]',
};

/** 特性卡列数（窄屏 1 列起步）。 */
export const ABOUT_FEATURE_COLS: Record<WebAboutColumns, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function aboutTitleClass(size: WebAboutSize): string {
  return ABOUT_TITLE_CLASS[size] ?? ABOUT_TITLE_CLASS.md;
}

/** 头部容器类：居中形态自带版心与居中。 */
export function aboutHeadClass(align: WebAboutAlign, size: WebAboutSize): string {
  return cn(
    ABOUT_HEAD_MB[size] ?? ABOUT_HEAD_MB.md,
    align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl',
  );
}

export function aboutMediaRatioClass(variant: WebAboutVariant): string {
  return ABOUT_MEDIA_RATIO[variant] ?? ABOUT_MEDIA_RATIO.split;
}

export function aboutMediaOrderClass(side: WebAboutMediaSide): string {
  return side === 'end' ? 'lg:order-last' : '';
}

export function aboutFeatureCols(cols: WebAboutColumns | number): string {
  return ABOUT_FEATURE_COLS[cols as WebAboutColumns] ?? ABOUT_FEATURE_COLS[3];
}

/** 特性卡角标：序号补零（1 → '01'）。 */
export function aboutFeatureIndex(index: number): string {
  return String(Math.max(0, Math.trunc(index)) + 1).padStart(2, '0');
}

/** 取值：字符串去空白；有限数字转字符串；其余为 null。 */
function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** HTML → 纯文本摘要（后台 sections 常只给 body，摘要缺失时回落）。 */
export function summarizeHtml(html: unknown, max = 120): string | null {
  if (typeof html !== 'string' || html.trim() === '') return null;
  const plain = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

/** 特性卡归一化：丢弃无标题项，字段名容错（title/label/name、summary/description/body）。 */
export function normalizeAboutFeatures(raw: unknown): WebAboutFeature[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: WebAboutFeature[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const title = text(r.title ?? r.label ?? r.name);
    if (!title) continue;
    out.push({
      title,
      summary: text(r.summary ?? r.description ?? r.text) ?? summarizeHtml(r.body ?? r.content),
      icon: text(r.icon ?? r.badge),
      href: text(r.href ?? r.url),
    });
  }
  return out;
}

/** 数据条归一化：丢弃无值项，字段名容错（value/number/count、label/name）。 */
export function normalizeAboutStats(raw: unknown): WebAboutStat[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: WebAboutStat[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const value = text(r.value ?? r.number ?? r.count);
    if (!value) continue;
    out.push({ value, label: text(r.label ?? r.name) });
  }
  return out;
}
