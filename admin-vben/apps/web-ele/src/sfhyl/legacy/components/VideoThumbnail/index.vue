<script setup lang="ts">
import { computed, ref } from "vue";
import { resolveMediaUrl } from "@/utils/media";

const props = withDefaults(
  defineProps<{
    src?: string | null;
    poster?: string | null;
    label?: string;
  }>(),
  { src: "", poster: "", label: "视频预览" }
);

const failed = ref(false);
const source = computed(() => resolveMediaUrl(props.src));
const poster = computed(() => resolveMediaUrl(props.poster));

function seekPreview(event: Event): void {
  const video = event.currentTarget as HTMLVideoElement;
  if (!Number.isFinite(video.duration) || video.duration <= 0.1) return;
  video.currentTime = 0.1;
}
</script>

<template>
  <div class="video-thumbnail" :class="{ 'has-error': failed }">
    <video
      v-if="source"
      :src="source"
      :poster="poster || undefined"
      :aria-label="label"
      muted
      playsinline
      preload="metadata"
      @loadedmetadata="seekPreview"
      @error="failed = true"
    />
    <div v-if="!source || failed" class="video-thumbnail__fallback">
      <IconifyIconOnline icon="ri:video-line" />
    </div>
    <span class="video-thumbnail__play" aria-hidden="true">
      <IconifyIconOnline icon="ri:play-fill" />
    </span>
  </div>
</template>

<style scoped>
.video-thumbnail {
  position: relative;
  overflow: hidden;
  background: #eef0f2;
}

.video-thumbnail video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #eef0f2;
}

.video-thumbnail__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 30px;
  color: #27313b;
}

.video-thumbnail__play {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: #fff;
  background: rgb(23 32 42 / 78%);
  border-radius: 4px;
}
</style>
