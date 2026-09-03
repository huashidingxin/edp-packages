/** 页面内容 Schema 字段类型。 */

export type PageContentFieldType =
  | 'string'
  | 'text'
  | 'richtext'
  | 'media'
  | 'array'
  | 'object'
  | 'boolean'
  | 'enum'
  | 'number'
  | 'link'
  | 'form_ref'
  | 'menu_ref'
  | 'collection_ref';

export interface PageContentFieldSchema {
  name: string;
  type: PageContentFieldType;
  required?: boolean;
  max?: number;
  min?: number;
  label?: string;
  item?: PageContentFieldSchema | PageContentFieldSchema[];
  fields?: PageContentFieldSchema[];
  kinds?: string[];
  ratio?: string;
  enum?: Array<{ label: string; value: string }>;
}

export interface PageContentPageSchema {
  content_key: string;
  fields: PageContentFieldSchema[];
}

export interface PageContentSchemaDocument {
  project_id: string;
  schema_version: number;
  pages: PageContentPageSchema[];
}

export type PageContentValue =
  | string
  | number
  | boolean
  | null
  | PageContentValue[]
  | { [key: string]: PageContentValue };
