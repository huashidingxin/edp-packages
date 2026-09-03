export interface LightboxItem {
  src: string;
  alt?: string | null;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function safeNextIndex(index: number, length: number): number {
  return clampIndex(index + 1, length);
}

export function safePrevIndex(index: number, length: number): number {
  return clampIndex(index - 1, length);
}
