# EDP shared packages

This directory is the single Git repository for reusable EDP packages.
Applications remain separate repositories and consume published package
versions; they must not depend on `../../packages` paths.

## Current packages

- `website/ui` → `@edp/website-ui`: Vue components, API client, contracts,
  theme/navigation helpers, and website UI logic.
- `website/runtime` → `@edp/website-runtime`: Nuxt module, layouts,
  composables, and standard website pages. It depends on `@edp/website-ui`.
- `miniprogram/runtime` → `@edp/miniprogram-runtime`: uni-app 公共层（**跨端：小程序 / H5 / APP**）。
  只做**公共工具与公共请求**，不做业务组件：`http` 请求封装与拦截、`appSite` 公开业务 API、`useAppCollection` 原生分页状态、`Resource` 通用 REST 工具、
  品牌令牌（含 uview 色板同步）、跨端路由（`openPath` / `openLink` / 原生 tabBar 的 `switchTab`
  纠正与咽喉点拦截）、整站 bootstrap、全局便捷入口（`uni.$edp` / `uni.Resource`）、端信息推导
  （`getPlatformDevice()`）、一次性装配（`setupAppRuntime`），以及可测纯逻辑。
  基础信息与词条（`/site/bootstrap?include=site,strings`）走**内存单例 + 本地缓存**的 stale-while-revalidate：
  冷启动先渲染缓存、同时请求覆盖；应用/API/语言隔离，reset/切换上下文后忽略旧响应。
  业务页在各应用侧用 `uni_modules/uview-plus` 自由拼装、各自请求数据。
  与 web 侧的差异：**没有 `pages/` 标准页面模板库**——uni-app `pages.json` 必须由应用声明。

> 2026-09 决策：早期设计的 `@edp/miniprogram-ui`（16 个 `Mp*` 组件）与
> `@edp/miniprogram-runtime` 里一批无真实消费方的工具（hooks 注入 / lib 工具集 /
> 通用拦截器链）已**整体删除**。公共布局与更多工具等后续从真实应用中**抽取**，
> 不再预先设计。命名统一去掉 `Mp` 前缀（`Mp*` → `App*`，如 `setupAppRuntime`），
> 因为同一份代码会编到 H5 / APP，`mp` 过于局限。

Future platform packages belong in `miniprogram/`, `shared/`, or `tooling/`
when there is a real second consumer. Keep application-specific code in the
application repository.

## Workspace commands

```bash
pnpm install
pnpm run check
pnpm run release:check
pnpm run release:dry-run
pnpm exec changeset
pnpm run version
pnpm run release
```

## Create the remote repository

This workspace is published from:

<https://github.com/huashidingxin/edp-packages>

For a fresh local copy of this directory, configure and publish the remote with:

```bash
git remote add origin git@github.com:huashidingxin/edp-packages.git
git push -u origin main
```

Git visibility and npm registry visibility are independent choices. A public
source repository may still publish restricted packages; set the registry and
the Changesets `access` value to match the organization's policy.

The current package names intentionally use the `@edp` scope. GitHub Packages
requires a package scope owned by the corresponding GitHub user/organization;
the `huashidingxin/edp-packages` repository alone does not make `@edp` a valid
GitHub Packages scope. Keep the names and use the organization's npm or Verdaccio
registry, or create/use an `edp` GitHub organization before choosing GitHub
Packages.

The workspace uses `workspace:^` only for dependencies between packages in
this repository. Published manifests are rewritten to normal semver ranges.
An application repository uses released versions, for example:

```json
{
  "dependencies": {
    "@edp/website-runtime": "0.1.0",
    "@edp/website-ui": "0.1.0"
  }
}
```

Before the first release, configure the organization's npm registry in a
local `.npmrc` (see `.npmrc.example`) and use a read-only token in application
CI.

For the first release, the two leaf packages already have version `0.1.0`.
After the registry and publish token are configured, run:

```bash
pnpm run release
```

Changesets will publish an unpublished `0.1.0` automatically. It publishes
`@edp/website-ui` and `@edp/website-runtime`; the latter declares the former
as a normal semver dependency in the published manifest. For later changes,
create a changeset, run `pnpm run version`, commit the resulting version/lock
changes, and then run `pnpm run release` in CI.

## Application integration

An application repository is intentionally not a member of this workspace.
After `@edp/website-ui` and `@edp/website-runtime` have been published, add
the released versions to the application itself:

```bash
pnpm add @edp/website-runtime@0.1.0 @edp/website-ui@0.1.0
```

The resulting manifest should contain normal semver versions, not `link:` or
relative `file:` paths:

```json
{
  "dependencies": {
    "@edp/website-runtime": "0.1.0",
    "@edp/website-ui": "0.1.0"
  }
}
```

Each application keeps its own lockfile and `.npmrc` (or CI-provided npm
configuration). A clean clone must build without the sibling `packages/`
directory. During local package development, use a packed tarball or a local
link only in an uncommitted override; do not commit that override to the
application repository.

The package Git repository alone is not a substitute for a registry when one
published package depends on another package in this workspace. Git-based
subdirectory dependencies can be used temporarily, but they pin source
commits and make transitive dependencies and CI credentials harder to manage.
