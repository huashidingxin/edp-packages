export type ShareChannel =
  | 'weibo'
  | 'wechat'
  | 'qq'
  | 'x'
  | 'linkedin'
  | 'facebook'
  | 'telegram'
  | 'link'

export const SHARE_CHANNELS: readonly ShareChannel[] = [
  'weibo',
  'wechat',
  'qq',
  'x',
  'linkedin',
  'facebook',
  'telegram',
  'link',
]

export const COPY_CHANNELS: readonly ShareChannel[] = ['wechat', 'link']

export function buildShareUrl(channel: ShareChannel, url: string, text: string): string | null {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  switch (channel) {
    case 'weibo':
      return `https://service.weibo.com/share/share.php?url=${u}&title=${t}`
    case 'qq':
      return `https://connect.qq.com/widget/shareqq/index.html?url=${u}&title=${t}`
    case 'x':
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`
    case 'telegram':
      return `https://t.me/share/url?url=${u}&text=${t}`
    case 'wechat':
    case 'link':
      return null
  }
}
