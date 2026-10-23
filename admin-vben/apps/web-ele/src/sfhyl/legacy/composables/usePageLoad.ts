import { ref } from 'vue';

import { getRequestErrorMessage } from '@/utils/http/error-message';

/** Keep failed reads distinct from successful empty responses. */
export function usePageLoad() {
  const loading = ref(false);
  const loadError = ref('');

  async function runLoad(task: () => Promise<void>): Promise<void> {
    loading.value = true;
    loadError.value = '';
    try {
      await task();
    } catch (error) {
      loadError.value = getRequestErrorMessage(error);
    } finally {
      loading.value = false;
    }
  }

  return { loading, loadError, runLoad };
}
