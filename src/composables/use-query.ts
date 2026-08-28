import { ref, shallowRef, onBeforeUnmount } from "vue";
import { messageOf } from "@/api/http";
export function useQuery<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T>();
  const loading = ref(false);
  const error = ref("");
  let sequence = 0;
  async function load() {
    const request = ++sequence;
    loading.value = true;
    error.value = "";
    try {
      const result = await fetcher();
      if (request === sequence) data.value = result;
    } catch (e) {
      if (request === sequence) {
        error.value = messageOf(e);
        data.value = undefined;
      }
    } finally {
      if (request === sequence) loading.value = false;
    }
  }
  onBeforeUnmount(() => {
    sequence++;
  });
  return { data, loading, error, load };
}
