/**
 * 读取**应用**的 `pages.json`（tab 页集合的唯一事实源）。
 *
 * `@` 是 uni-app 的编译期别名，始终指向 `UNI_INPUT_DIR`，而 `pages.json` 必然在其根上
 * （`src/` 布局是 `<input>/src/pages.json`，HBuilderX 根目录布局是 `<input>/pages.json`），
 * 所以包内 `@/pages.json` 与参考项目 `utils/page.js`（应用代码）拿到的是同一个文件 —— 已实测：
 * 该 JSON 会被编译进包代码所在 chunk，应用不需要再手动传 `pagesJson`。
 *
 * 两个约束：
 * 1. `pages.json` **不能写注释**（`//` 或块注释）—— 它按 JSON 解析，注释会让构建失败。
 *    确需注释时改用 `setupAppRouter({ tabPaths: [...] })` / `setupAppRuntime({ tabPaths })` 显式声明；
 * 2. 本文件**只允许被包入口 `index.ts` 引用**，单测与纯逻辑模块不得 import 它 ——
 *    node 下没有 `@` 别名，一旦进单测图，包就失去独立回归能力。
 */
import pagesJson from '@/pages.json'

export default pagesJson
