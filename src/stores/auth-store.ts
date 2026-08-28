import { defineStore } from "pinia";
import {
  getCurrentEmployee,
  login,
  logout,
  clearCsrfToken,
  type Employee,
} from "@/api/auth-api";
import { ApiError, discardSessionRequests } from "@/api/http";
export const useAuthStore = defineStore("auth", {
  state: () => ({
    employee: null as Employee | null,
    restored: false,
    restoreError: "",
  }),
  getters: { isAuthenticated: (state) => state.employee !== null },
  actions: {
    async restore(): Promise<boolean> {
      this.restoreError = "";
      try {
        this.employee = await getCurrentEmployee();
        this.restored = true;
        return true;
      } catch (error) {
        this.employee = null;
        if (error instanceof ApiError && error.status === 401) {
          this.restored = true;
          return false;
        }
        this.restoreError =
          error instanceof Error ? error.message : "无法确认登录状态";
        return false;
      }
    },
    async signIn(username: string, password: string) {
      this.employee = await login(username, password);
      this.restored = true;
      this.restoreError = "";
    },
    async signOut() {
      await logout();
      this.clear();
    },
    clear() {
      this.employee = null;
      this.restored = false;
      clearCsrfToken();
      discardSessionRequests();
    },
  },
});
