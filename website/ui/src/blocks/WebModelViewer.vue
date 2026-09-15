<script setup lang="ts">
/**
 * WebModelViewer —— 3D 模型预览（@google/model-viewer 的 SSR 安全包装）。
 *
 * 职责：把 glb/gltf 模型以可旋转 / 可拖拽的 web component 渲染出来，
 * SSR/SSG 阶段仅输出海报图兜底，客户端 onMounted 动态 import 注册 CE 后升级。
 * 站点自建产品页可直接 import { WebModelViewer } from '@edp/website-ui' 复用。
 *
 * 部件变量：--ratio-record（媒体区比例，缺省 1/1）；
 *           --web-record-media-fit（object-fit，缺省 cover；模型建议 contain）。
 */
import { onMounted, ref } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'

const props = withDefaults(
  defineProps<{
    /** 模型 URL（.glb / .gltf）。 */
    src?: string | null
    /** 模型未加载 / SSR 阶段的海报图。 */
    poster?: string | null
    /** 无障碍描述。 */
    alt?: string | null
    /** 自动旋转。 */
    autoRotate?: boolean
    /** 允许用户拖拽旋转（缺省 true）。 */
    cameraControls?: boolean
    class?: ClassValue
  }>(),
  {
    src: null,
    poster: null,
    alt: null,
    autoRotate: false,
    cameraControls: true,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

/** CE 已注册就绪（客户端动态 import 完成后置真）。 */
const ready = ref(false)
/** 加载失败（model-viewer error 事件）。 */
const failed = ref(false)

onMounted(async () => {
  if (!props.src) return
  try {
    // 动态 import 注册 <model-viewer> Custom Element；仅客户端执行，SSR 不触碰 window。
    await import('@google/model-viewer')
    ready.value = true
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div
    v-if="src"
    class="web-model-viewer group relative aspect-[var(--ratio-record,1/1)] w-full overflow-hidden rounded-card bg-muted shadow-card"
    :class="cn(props.class)"
  >
    <!-- model-viewer（CE 就绪后才渲染，避免 SSR 闪现未升级标签） -->
    <model-viewer
      v-if="ready && !failed"
      :src="src"
      :alt="alt ?? ''"
      :poster="poster ?? undefined"
      :auto-rotate="autoRotate"
      :camera-controls="cameraControls"
      shadow-intensity="1"
      interaction-prompt="none"
      class="size-full [object-fit:var(--web-record-media-fit,contain)]"
      @error="failed = true"
    />

    <!-- 海报兜底：SSR 阶段 + CE 未就绪 + 加载失败时可见 -->
    <img
      v-else-if="poster"
      :src="poster"
      :alt="alt ?? ''"
      class="size-full [object-fit:var(--web-record-media-fit,contain)] transition duration-300 ease-out"
      :class="!failed ? 'opacity-100' : 'opacity-60'"
      loading="eager"
    >

    <!-- 无海报且未就绪：占位 -->
    <div
      v-else-if="!failed"
      class="flex size-full items-center justify-center text-sm text-muted-foreground"
      :aria-label="componentStrings.WebModelViewer.label"
    >
      <span class="inline-flex animate-pulse items-center gap-2">
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
        {{ componentStrings.WebModelViewer.label }}
      </span>
    </div>

    <!-- 加载失败提示 -->
    <div
      v-else
      class="flex size-full items-center justify-center px-4 text-center text-xs text-muted-foreground"
      role="alert"
    >
      {{ componentStrings.WebModelViewer.loadError }}
    </div>
  </div>
</template>
