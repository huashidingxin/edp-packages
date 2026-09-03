<script setup lang="ts">
/** WebMarquee —— 无缝横向滚动条带(logo 墙/图片条/证书直排)。轨道复制一份实现无缝循环;悬停暂停;弱动效降级为可横向滚动。
 *  事件：select(item, index) —— 条目无 href 时点击触发（站点可接灯箱预览等）。 */
import { computed } from 'vue'
import { componentStrings } from '../componentStrings.ts'

export interface WebMarqueeItem {
  image: string
  alt?: string
  href?: string | null
}

const emit = defineEmits<{ select: [item: WebMarqueeItem, index: number] }>()

/** 无 href 的条目点击时上报 select；有 href 的条目照常跳转不拦截。 */
function onSelect(item: WebMarqueeItem, index: number) {
  if (!item.href) emit('select', item, index)
}

const props = withDefaults(
  defineProps<{
    items?: WebMarqueeItem[]
    /** logo=灰度小图 hover 上色(合作伙伴墙);photo=圆角图片卡(车间实拍等);
     *  doc=竖版文档/证书直排：按原始比例完整呈现，白底细边框+柔和投影=墙上证书的质感（非卡中卡）。 */
    variant?: 'logo' | 'photo' | 'doc'
    /** 单程滚动时长(秒),过小会被钳制。 */
    speed?: number
    /** 悬停暂停滚动(默认开)。 */
    pauseOnHover?: boolean
  }>(),
  { items: () => [], variant: 'logo', speed: 30, pauseOnHover: true },
)

const loop = computed(() => props.items.filter((i) => !!i.image))
const duration = computed(() => `${Math.max(8, props.speed)}s`)
</script>

<template>
  <div
    v-if="loop.length"
    class="web-marquee group/marquee relative overflow-hidden"
    role="region"
    :aria-label="componentStrings.WebMarquee.label"
  >
    <div
      class="web-marquee__track flex w-max items-center"
      :class="[
        pauseOnHover ? 'group-hover/marquee:[animation-play-state:paused]' : '',
        variant === 'logo'
          ? 'gap-10 pr-10 sm:gap-14 sm:pr-14'
          : variant === 'doc'
            ? 'gap-8 pr-8 sm:gap-10 sm:pr-10'
            : 'gap-4 pr-4',
      ]"
      :style="{ animationDuration: duration }"
    >
      <template v-for="pass in 2" :key="pass">
        <component
          :is="item.href ? 'a' : 'div'"
          v-for="(item, i) in loop"
          :key="`${pass}-${i}`"
          :href="item.href ?? undefined"
          class="web-marquee__item shrink-0 cursor-pointer"
          :role="item.href ? undefined : 'button'"
          :aria-hidden="pass === 2 ? 'true' : undefined"
          :tabindex="pass === 2 ? -1 : undefined"
          @click="onSelect(item, i)"
        >
          <img
            :src="item.image"
            :alt="item.alt ?? ''"
            loading="lazy"
            :class="
              variant === 'logo'
                ? 'h-14 w-auto max-w-40 object-contain opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 sm:h-16'
                : variant === 'doc'
                  ? 'h-64 w-auto rounded-md border border-border bg-card object-contain shadow-card transition-transform duration-300 hover:-translate-y-1 sm:h-80'
                  : 'h-40 w-64 rounded-card border border-border object-cover shadow-card transition-transform duration-500 hover:scale-[1.03] sm:h-48 sm:w-80'
            "
          >
        </component>
      </template>
    </div>
  </div>
</template>

<style scoped>
.web-marquee__track {
  animation-name: web-marquee-scroll;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes web-marquee-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
/* 弱动效偏好:停止滚动,降级为可横向滑动的静态条 */
@media (prefers-reduced-motion: reduce) {
  .web-marquee__track {
    animation: none;
  }
  .web-marquee {
    overflow-x: auto;
  }
}
</style>
