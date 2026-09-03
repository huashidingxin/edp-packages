# @edp/website-ui Block 实现规范（内部）

所有 `src/blocks/*.vue` 必须遵守。参考实现：`src/blocks/WebCard.vue`。

## 分层（两层制）

- **blocks/**：语义 + 默认视觉（本文件约束的对象）
- **lib/**：可测纯逻辑（node:test 覆盖）
- **交互行为**：直接组装 `reka-ui` 原件，**不做二次封装**。需要弹层时在 block 内
  引入 `DialogRoot/SheetRoot/PopoverRoot/DropdownMenuRoot…` 部件拼装；
  共享接线样式常量取自 `lib/ui.ts`（`overlayClass` / `floatingClass`）。

## reka-ui 组装约定

1. 弹层必经 Portal；遮罩用 `:class="overlayClass"`，内容挂 `:class="floatingClass"`。
2. z-index 梯队：header=40，浮层统一 z-50，chat widget z-50。
3. 状态样式一律走 `data-[state=open/closed]` 变体，不写 JS 切类。
4. 触发器用 `<XxxTrigger as-child>` 包住业务按钮；面板内导航链接用
   `NavigationMenuLink as-child :active`（自动落 aria-current）。

## 命名

- 组件名 = 文件名 = `O` + PascalCase（WebHeader / WebFooter / WebHero…）。
- 语义类：根 `o-{kebab}`，修饰 `o-{kebab}--{variant|kind}`，部件 `o-{kebab}__{part}`。
- data 钩子：根元素输出 `data-variant` 等变体属性。
- 部件级 CSS 变量：`--o-{kebab}-{part-prop}`，模板内一律 `var(--o-*, fallback)`。

## 样式

1. 默认外观用 Tailwind 工具类写在模板内；**禁止裸 hex/px 字面量**
   （颜色一律 `text-primary` / `bg-card` 等令牌工具类；布局常量走
   `var(--o-*, …)` 或 `@theme inline` 已注册的令牌：
   `rounded-card`、`shadow-card/lift/pop`、`aspect-card/media/portrait/hero`、
   `max-w-site`、`text-display-sm/md/lg`）。
2. 变体用 `class-variance-authority` 的 `cva()`；variants 里只放类字符串。
3. class 合并：根节点 `cn(cvaResult, $attrs.class ?? props.class)`；
   组件显式声明 `defineOptions({ inheritAttrs: false })` 时自行挂 `$attrs`。
4. 交互过渡统一挂 `.web-motion`（站点可用变量整体调速/禁用）；入场动画用 `.web-rise-in`。
5. 行数截断用 `.web-clamp-2/.web-clamp-3`，数字用 `.web-num`。

## 结构

- 可见文本零硬编码：默认值登记 `../componentStrings.ts`，模板里
  `{{ componentStrings.WebXxx.key }}`；其余文本全部 props 化。
- 插槽逃生口：内容型 block 至少提供内容插槽（#title/#meta/#actions…）
  与整身替换 #default；被替换后不残留多余包装 DOM。
- 链接一律渲染 `<a href>`（企业站无 SPA 路由依赖）；多语言路径由调用方拼好传入。
- 图片必带 alt（props.imageAlt 兜底 title）、`loading="lazy"`。
- SSR 安全：不用 window/document 顶层访问；客户端逻辑进 onMounted / ClientOnly。

## 导出

新 block 完成后在 `src/blocks/index.ts` 追加
`export { default as WebXxx } from './WebXxx.vue'` 与类型导出；可见文本同步登记 componentStrings。
