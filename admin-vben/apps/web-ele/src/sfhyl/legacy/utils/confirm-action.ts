import { ElMessageBox } from 'element-plus';

/** Cancel and close are normal UI outcomes, rather than request failures. */
export async function confirmAction(message: string, title: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    });
    return true;
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return false;
    throw reason;
  }
}
