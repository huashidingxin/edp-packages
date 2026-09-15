/**
 * 端信息（**跨端**：小程序 / H5 / APP 通用）。
 *
 * `device` 是后端 `page-data?device=` 的取值：用于终端适配（banner 选图等）并进缓存键
 * （见后端 `RenderContext`，其默认值就是 `'web'`，所以 H5 用 `'web'` 正好与后端对齐）。
 *
 * 早期我们把它写成应用配置里的手写常量（`mpDevice = 'mp-weixin'`）—— 端名本来就是
 * 平台事实，不该由应用维护：H5 / APP 端复制同一个应用时，那个常量就错了。这里按平台推导。
 */
import { getUni } from './global.ts'

/** `uniPlatform` 取值：`mp-weixin` / `mp-alipay` / `mp-toutiao` / `web`（H5）/ `app`（APP）。 */
export type PlatformDevice = 'mp-weixin' | 'mp-alipay' | 'mp-toutiao' | 'web' | 'app' | (string & {})

/**
 * 当前终端标识（同时用作后端 `device` 参数）。
 * 取不到平台信息（如 node 单测、非 uni 容器）时回落 `'web'`，与后端默认值一致。
 */
export function getPlatformDevice(): PlatformDevice {
  const u = getUni()
  if (!u) return 'web'
  // 优先 `getAppBaseInfo`（新 API），旧版本回落 `getSystemInfoSync`
  const info =
    (typeof u.getAppBaseInfo === 'function' ? u.getAppBaseInfo() : undefined) ??
    (typeof u.getSystemInfoSync === 'function' ? u.getSystemInfoSync() : undefined)
  const platform = info?.uniPlatform
  return typeof platform === 'string' && platform ? platform : 'web'
}
