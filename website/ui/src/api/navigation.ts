import type { BreadcrumbItem, RecordNavigationItem } from '../contracts/index.ts';

/** 给定记录导航 + 当前 path，输出面包屑样式。 */
export function buildRecordBreadcrumb(
  record: { title?: string } | null,
  categoryContext: { values: { title?: string } } | null,
  listHref: string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  if (categoryContext) {
    const t = categoryContext.values?.title ?? '';
    items.push({ label: t, href: listHref, current: false });
  }
  if (record) {
    items.push({ label: record.title ?? '', href: null, current: true });
  }
  return items;
}

/** 从 navigation 上下一条中找出非当前 id 的项（防御自环数据）。 */
export function pickNext(navigation: { previous?: RecordNavigationItem | null; next?: RecordNavigationItem | null } | null | undefined, currentId: number | null): RecordNavigationItem | null {
  if (!navigation) return null;
  if (navigation.next && (currentId == null || navigation.next.id !== currentId)) return navigation.next;
  return null;
}

/** 同上 previous。 */
export function pickPrevious(navigation: { previous?: RecordNavigationItem | null; next?: RecordNavigationItem | null } | null | undefined, currentId: number | null): RecordNavigationItem | null {
  if (!navigation) return null;
  if (navigation.previous && (currentId == null || navigation.previous.id !== currentId)) return navigation.previous;
  return null;
}
