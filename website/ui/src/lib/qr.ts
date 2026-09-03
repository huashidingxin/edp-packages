/**
 * QR 码纯逻辑 —— 包一层 qrcode-generator，产出与主题同色的内联 SVG 路径
 * （node:test 覆盖：形状合法性 / 暗模块计数 / 失败回落 null）。
 */
import qrcode from 'qrcode-generator';

export interface QrSvg {
  /** 暗模块 path（1 单位 = 1 模块，含 quiet-zone 偏移）。 */
  d: string;
  /** viewBox 边长（模块数 + 两侧 quiet zone）。 */
  size: number;
}

/** 二维码转内联 SVG 数据；生成失败（数据超长等）返回 null，由调用方兜底。 */
export function qrSvg(text: string, quietZone = 2): QrSvg | null {
  const value = text.trim();
  if (!value) return null;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const parts: string[] = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) {
          parts.push(`M${col + quietZone} ${row + quietZone}h1v1h-1z`);
        }
      }
    }
    return { d: parts.join(''), size: n + quietZone * 2 };
  } catch {
    return null;
  }
}
