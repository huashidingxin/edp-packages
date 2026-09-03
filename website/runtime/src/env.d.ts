declare module '#app' {
  interface NuxtApp {
    $site: import('@edp/website-ui').SiteClient
  }
  interface RuntimeConfig {
    apiBase: string
  }
  interface RuntimeConfig {
    public: {
      apiBase: string
      forceHost: string
      previewDomain: string
      /** '1' 时会话走 MockAuthProvider（契约先行）。 */
      authMock?: string
      chatWidget?: boolean
      userWidget?: boolean
    }
  }
  interface AppConfig {
    website: {
      modules: import('./lib/modules.ts').ResolvedWebsiteModules
      /** 站点菜单增强(app.config.ts 声明;键=菜单项 title 或 id)。 */
      menuEnhancements?: import('./lib/menus.ts').WebMenuEnhancements
    }
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    /** 模板路由携带的解析后模块配置（module 注册时写入）。 */
    websiteModules?: import('./lib/modules.ts').ResolvedWebsiteModules
  }
}

// 包内 .vue 文件（layouts/app 兜底）由站点 tsconfig 通配声明兜底。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

export {}
