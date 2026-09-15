import assert from 'node:assert/strict'
import test from 'node:test'
import { loadImageCategory } from '../src/lib/imageCategory.ts'

test('mixed legacy category reads only its independent sources and preserves order across tables', async () => {
  const calls: string[] = []
  const result = await loadImageCategory({
    async category() { return { category: { id: 3, values: { title: '资质荣誉', content_types: ['certificate', 'honor'] }, family: 'gallery-list' } } },
    async collection(type, query) {
      calls.push(type)
      assert.equal(query.category_slug, 'gallery/qualifications')
      assert.equal(query.locale, 'en-US')
      assert.equal(query.pagination, 'simple')
      return { items: [{ key: `${type}:1`, values: { id: 1, sort: type === 'honor' ? 1 : 2 } }], meta: {} }
    },
  }, 'gallery/qualifications', 'en-US')
  assert.deepEqual(calls, ['certificate', 'honor'])
  assert.deepEqual(result.items.map((item) => item.key), ['honor:1', 'certificate:1'])
  assert.equal(result.category?.values.title, '资质荣誉')
})

test('an explicitly empty category performs no collection reads', async () => {
  const result = await loadImageCategory({
    async category() { return { category: { id: 3, values: { content_types: [] }, family: 'gallery-list' } } },
    async collection() { throw new Error('Unused source queried') },
  }, 'gallery/empty')
  assert.deepEqual(result.items, [])
})
