import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { ElMessageBox } from "element-plus";

export function useUnsavedChanges(isDirty: Readonly<Ref<boolean>>): void {
  const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!isDirty.value) return;
    event.preventDefault();
    event.returnValue = "";
  };

  onMounted(() => window.addEventListener("beforeunload", handleBeforeUnload));
  onBeforeUnmount(() =>
    window.removeEventListener("beforeunload", handleBeforeUnload)
  );

  onBeforeRouteLeave(async () => {
    if (!isDirty.value) return true;
    try {
      await ElMessageBox.confirm(
        "当前修改尚未保存，离开后将丢失。是否继续？",
        "未保存的修改",
        {
          type: "warning",
          confirmButtonText: "离开",
          cancelButtonText: "继续编辑"
        }
      );
      return true;
    } catch {
      return false;
    }
  });
}
