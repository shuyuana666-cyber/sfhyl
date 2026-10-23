import { computed, reactive, ref, type Ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createFolder,
  deleteFolder,
  updateFolder,
  type MediaFolder
} from "@/api/media";

interface UseMediaFoldersOptions {
  folders: Ref<MediaFolder[]>;
  folderId: Ref<string>;
  deleted: Ref<string>;
  saving: Ref<boolean>;
  reload: () => Promise<void>;
}

export function useMediaFolders({
  folders,
  folderId,
  deleted,
  saving,
  reload
}: UseMediaFoldersOptions) {
  const folderOpen = ref(false);
  const editingFolderId = ref("");
  const folderForm = reactive({ name: "", parentId: "" });

  const currentFolder = computed(() =>
    folderId.value
      ? folders.value.find(folder => folder.id === folderId.value) || null
      : null
  );
  const childFolders = computed(() => {
    if (deleted.value === "true") return [];
    return folders.value.filter(
      folder => (folder.parentId || "") === folderId.value
    );
  });
  const breadcrumbs = computed(() => {
    const result: MediaFolder[] = [];
    let folder = currentFolder.value;
    while (folder) {
      result.unshift(folder);
      folder = folder.parentId
        ? folders.value.find(item => item.id === folder?.parentId) || null
        : null;
    }
    return result;
  });

  function createFolderDialog(): void {
    editingFolderId.value = "";
    Object.assign(folderForm, { name: "", parentId: folderId.value });
    folderOpen.value = true;
  }

  function editFolderDialog(folder: MediaFolder): void {
    editingFolderId.value = folder.id;
    Object.assign(folderForm, {
      name: folder.name,
      parentId: folder.parentId || ""
    });
    folderOpen.value = true;
  }

  async function saveFolder(): Promise<void> {
    if (!folderForm.name.trim()) {
      ElMessage.warning("请填写文件夹名称");
      return;
    }
    saving.value = true;
    try {
      const data = { name: folderForm.name.trim(), parentId: folderForm.parentId || null };
      editingFolderId.value
        ? await updateFolder(editingFolderId.value, data)
        : await createFolder(data);
      folderOpen.value = false;
      await reload();
    } finally {
      saving.value = false;
    }
  }

  async function removeFolder(folder: MediaFolder): Promise<void> {
    await ElMessageBox.confirm(
      `确认删除文件夹“${folder.name}”？其中的素材和子文件夹将自动移到上一级。`,
      "删除文件夹",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
    await deleteFolder(folder.id);
    if (folderId.value === folder.id) folderId.value = folder.parentId || "";
    ElMessage.success("文件夹已删除");
    await reload();
  }

  return {
    breadcrumbs,
    childFolders,
    currentFolder,
    createFolderDialog,
    editFolderDialog,
    editingFolderId,
    folderForm,
    folderOpen,
    removeFolder,
    saveFolder
  };
}
