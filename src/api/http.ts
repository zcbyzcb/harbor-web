import axios, { type AxiosError } from "axios";
export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  requestId?: string;
}
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}
let generation = 0;
let controller = new AbortController();
let unauthorized: (() => void) | undefined;
export function onUnauthorized(callback: () => void) {
  unauthorized = callback;
}
export function discardSessionRequests() {
  generation++;
  controller.abort();
  controller = new AbortController();
}
export const http = axios.create({
  baseURL: "/api",
  timeout: 10000,
  withCredentials: true,
});
const requestGenerations = new WeakMap<object, number>();
http.interceptors.request.use((config) => {
  config.signal ??= controller.signal;
  config.headers["X-Request-ID"] = crypto.randomUUID();
  requestGenerations.set(config, generation);
  return config;
});
http.interceptors.response.use(
  (response) => {
    if (requestGenerations.get(response.config) !== generation)
      throw new ApiError("STALE_RESPONSE", "会话已变化，请重新查询");
    return response;
  },
  (error: AxiosError<ApiResponse<never>>) => {
    if (error.config && requestGenerations.get(error.config) !== generation)
      return Promise.reject(new ApiError("STALE_RESPONSE", "会话已变化"));
    const data = error.response?.data;
    if (
      error.response?.status === 401 &&
      error.config?.url !== "/auth/login" &&
      error.config?.url !== "/auth/me"
    )
      unauthorized?.();
    return Promise.reject(
      new ApiError(
        data?.code ?? "NETWORK_ERROR",
        data?.message ?? "网络中断，操作结果待确认",
        error.response?.status,
      ),
    );
  },
);
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请重试";
}
export function resultUnknown(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    [
      "NETWORK_ERROR",
      "RESULT_UNKNOWN",
      "RETRY_SAME_REQUEST",
      "CSRF_INVALID",
      "IDEMPOTENCY_CONFLICT",
    ].includes(error.code)
  );
}
export async function get<T>(url: string, params?: object): Promise<T> {
  return (await http.get<ApiResponse<T>>(url, { params })).data.data;
}
