/** WebCard 内容类型。 */
export type WebCardKind = 'product' | 'article' | 'case' | 'gallery' | 'plain';

/** 各 kind 的默认媒体比例（CSS aspect-ratio 值）。 */
export const CARD_KIND_DEFAULT_RATIO: Record<WebCardKind, string> = {
  product: '4/3',
  article: '16/10',
  case: '16/9',
  gallery: '4/3',
  plain: '4/3',
};
