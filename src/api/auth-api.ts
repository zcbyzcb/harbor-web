import { http, get, ApiError, type ApiResponse } from "./http";
export interface Employee {
  employeeId: string;
  username: string;
  displayName: string;
}
interface CsrfToken {
  headerName: string;
  token: string;
}
let csrfToken: CsrfToken | null = null;
export function clearCsrfToken() {
  csrfToken = null;
}
export async function refreshCsrfToken() {
  csrfToken = await get<CsrfToken>("/auth/csrf");
}
export async function post<T>(
  url: string,
  body: unknown,
  key?: string,
): Promise<T> {
  if (!csrfToken) await refreshCsrfToken();
  const token = csrfToken!;
  try {
    const response = await http.post<ApiResponse<T>>(url, body, {
      headers: {
        [token.headerName]: token.token,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
    });
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiError && error.code === "CSRF_INVALID") {
      clearCsrfToken();
      // Only refresh read-only identity and token; never replay a POST automatically.
      if (url !== "/auth/login") await getCurrentEmployee();
      await refreshCsrfToken();
      throw new ApiError(
        "CSRF_INVALID",
        "安全令牌已更新，请使用原请求重试",
        403,
      );
    }
    throw error;
  }
}
export async function login(
  username: string,
  password: string,
): Promise<Employee> {
  try {
    return await post<Employee>("/auth/login", { username, password });
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["NETWORK_ERROR", "RESULT_UNKNOWN"].includes(error.code)
    ) {
      try {
        const employee = await getCurrentEmployee();
        if (employee.username.toLowerCase() === username.trim().toLowerCase())
          return employee;
      } catch {
        /* Original login outcome remains unknown. */
      }
    }
    throw error;
  } finally {
    clearCsrfToken();
  }
}
export function getCurrentEmployee() {
  return get<Employee>("/auth/me");
}
export async function logout() {
  await post<null>("/auth/logout", null);
  clearCsrfToken();
}
