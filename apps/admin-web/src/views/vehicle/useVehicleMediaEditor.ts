import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import Sortable from "sortablejs";
import { ElMessage } from "element-plus";
import type { MediaAsset } from "@/types/business";
import { resolveMediaUrl } from "@/utils/media";

export interface MediaDraft {
  mediaId: string;
  sortOrder: number;
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
}

export function useVehicleMediaEditor() {
  const selectedMediaIds = ref<string[]>([]);
  const selectedMediaAssets = ref<Record<string, MediaAsset>>({});
  const mediaRows = ref<MediaDraft[]>([]);
  const mediaListRef = ref<HTMLElement>();
  let mediaSortable: Sortable | null = null;

  function mediaUrl(asset: MediaAsset): string {
    return resolveMediaUrl(
      asset.mimeType.startsWith("image/")
        ? asset.webpUrl || asset.url
        : asset.url
    );
  }

  function rememberSelectedMedia(items: MediaAsset[]): void {
    for (const asset of items) selectedMediaAssets.value[asset.id] = asset;
    mediaRows.value.forEach(row => {
      const asset = selectedMediaAssets.value[row.mediaId];
      if (!asset) return;
      row.url = mediaUrl(asset);
      row.thumbnailUrl = asset.thumbnailUrl
        ? resolveMediaUrl(asset.thumbnailUrl)
        : undefined;
      row.mimeType = asset.mimeType;
    });
  }

  function isAutoCover(item: MediaDraft): boolean {
    if (!item.mimeType?.startsWith("image/")) return false;
    return (
      mediaRows.value.find(row => row.mimeType?.startsWith("image/"))
        ?.mediaId === item.mediaId
    );
  }

  function moveMedia(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= mediaRows.value.length) return;
    const rows = [...mediaRows.value];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    rows.forEach((item, order) => {
      item.sortOrder = order;
    });
    mediaRows.value = rows;
    selectedMediaIds.value = rows.map(item => item.mediaId);
  }

  function replaceMedia(index: number, items: MediaAsset[]): void {
    const replacement = items[0];
    const current = mediaRows.value[index];
    if (!replacement || !current || replacement.id === current.mediaId) return;
    if (
      mediaRows.value.some(
        (item, itemIndex) =>
          itemIndex !== index && item.mediaId === replacement.id
      )
    ) {
      ElMessage.warning("该素材已在车辆媒体列表中");
      return;
    }

    current.mediaId = replacement.id;
    rememberSelectedMedia([replacement]);
    current.url = mediaUrl(replacement);
    current.thumbnailUrl = replacement.thumbnailUrl
      ? resolveMediaUrl(replacement.thumbnailUrl)
      : undefined;
    current.mimeType = replacement.mimeType;
    selectedMediaIds.value = mediaRows.value.map(item => item.mediaId);
  }

  function setupMediaSorting(): void {
    mediaSortable?.destroy();
    mediaSortable = null;
    if (!mediaListRef.value || mediaRows.value.length < 2) return;
    mediaSortable = Sortable.create(mediaListRef.value, {
      animation: 150,
      handle: ".media-drag-handle",
      ghostClass: "is-dragging",
      onEnd: event => {
        const from = event.oldIndex;
        const to = event.newIndex;
        if (from === undefined || to === undefined || from === to) return;
        const rows = [...mediaRows.value];
        const [moved] = rows.splice(from, 1);
        rows.splice(to, 0, moved);
        event.item.remove();
        event.from.insertBefore(event.item, event.from.children[from] ?? null);
        rows.forEach((item, order) => {
          item.sortOrder = order;
        });
        mediaRows.value = rows;
        selectedMediaIds.value = rows.map(item => item.mediaId);
      }
    });
  }

  function removeMedia(mediaId: string): void {
    selectedMediaIds.value = selectedMediaIds.value.filter(
      id => id !== mediaId
    );
  }

  watch(
    selectedMediaIds,
    ids => {
      const previous = new Map(
        mediaRows.value.map(item => [item.mediaId, item])
      );
      mediaRows.value = ids.map((mediaId, index) => {
        const asset = selectedMediaAssets.value[mediaId];
        return (
          previous.get(mediaId) ?? {
            mediaId,
            sortOrder: index,
            url: asset ? mediaUrl(asset) : undefined,
            thumbnailUrl: asset?.thumbnailUrl
              ? resolveMediaUrl(asset.thumbnailUrl)
              : undefined,
            mimeType: asset?.mimeType
          }
        );
      });
    },
    { deep: true }
  );

  watch(
    () => mediaRows.value.length,
    async () => {
      await nextTick();
      setupMediaSorting();
    }
  );

  onBeforeUnmount(() => mediaSortable?.destroy());

  return {
    isAutoCover,
    mediaListRef,
    mediaRows,
    mediaUrl,
    moveMedia,
    removeMedia,
    rememberSelectedMedia,
    replaceMedia,
    selectedMediaIds
  };
}
