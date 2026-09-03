import type { RouterConfig } from '@nuxt/schema'

/**
 * 为非默认语言（en-US → /en）生成文件路由别名。
 * 平台约定：默认语言无前缀，其他启用语言使用 /{lang} 短码前缀。
 */
export default <RouterConfig>{
  routes: (_routes) => {
    const routes = [..._routes]
    for (const route of _routes) {
      if (route.path.includes(':pathMatch')) continue
      routes.push({
        ...route,
        path: route.path === '/' || route.path === '' ? '/en' : `/en${route.path}`,
        name: route.name ? `${String(route.name)}-en` : undefined,
      })
    }
    return routes
  },
}
