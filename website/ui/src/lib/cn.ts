import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes and conditionals (clsx + twMerge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 块级组件根类拼装约定：
 * cva 变体类在前（可被覆盖），语义类 o-* 恒在（站点覆盖钩子），外部 class 最后。
 */
export function blockClass(variantClass: string | undefined, semantic: string, extra?: ClassValue): string {
  return cn(variantClass, semantic, extra);
}
