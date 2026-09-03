/**
 * 设计预览 token 解析。
 *
 * 后端开发预览模式：preview 域名（如 `edp.hsdxchina.com`）的子域可使用首段作为
 * preview token，通过 v2 接口 `?preview_token={token}` 携带，后端据此读草稿 schema。
 * 例如 `abc123.edp.hsdxchina.com` -> token `abc123`。
 */

const PREVIEW_HOST_RE = /^(?<token>[a-z0-9][a-z0-9-]{0,120})\.(?<rest>.+)$/i;

/**
 * 判断 host 是否属于 preview domain，并解析出 preview token。
 * @param host 当前请求域名（已经剥离端口）。
 * @param previewDomain preview 域名（如 `edp.hsdxchina.com`）。
 * @returns token 字符串；非 preview 域名或根域名返回 null。
 */
export function designPreviewTokenForHost(host: string, previewDomain: string): string | null {
  const pDomain = (previewDomain ?? '').toLowerCase().trim();
  if (pDomain === '') return null;
  const h = (host ?? '').toLowerCase().trim().split(':')[0] ?? '';
  if (!h.endsWith(`.${pDomain}`)) return null;
  if (h === pDomain) return null;
  const match = PREVIEW_HOST_RE.exec(h);
  if (!match || !match.groups) return null;
  return match.groups['token'] ?? null;
}
