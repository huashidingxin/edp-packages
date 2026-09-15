import type { CategoryResponse, CollectionResponse } from '@edp/website-ui/contracts'

const imageTypes = new Set(['gallery-item', 'honor', 'certificate', 'partner'])

/** Existing gallery URLs can contain independently stored image content. Layout stays in the page. */
export async function loadImageCategory(client: {
  category(query: { path: string; locale?: string }): Promise<CategoryResponse>
  collection(type: string, query: { category_slug: string; locale?: string; limit: number; pagination: 'simple'; order: string }): Promise<CollectionResponse>
}, path: string, locale?: string) {
  const context = await client.category({ path, locale })
  const configured = context.category?.values?.content_types
  const types = context.category
    ? [...new Set((Array.isArray(configured) ? configured : ['gallery-item']).filter((type): type is string => typeof type === 'string' && imageTypes.has(type)))]
    : []
  const collections = await Promise.all(types.map((type) => client.collection(type, {
    category_slug: path, locale, limit: 100, pagination: 'simple', order: 'sort_asc',
  })))
  const items = collections.flatMap((collection) => collection.items)
    .sort((a, b) => Number(a.values.sort ?? 0) - Number(b.values.sort ?? 0)
      || Number(a.values.id) - Number(b.values.id)
      || a.key.localeCompare(b.key))
    .slice(0, 100)
  return { ...context, items }
}
