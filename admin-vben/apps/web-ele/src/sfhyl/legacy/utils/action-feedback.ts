import { getRequestErrorMessage } from '@/utils/http/error-message';
import { ElMessage } from 'element-plus';

export function showActionError(error: unknown): void {
  ElMessage.error({ message: getRequestErrorMessage(error), grouping: true });
}
