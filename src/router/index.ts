import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth-store";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/login/LoginView.vue"),
    },
    {
      path: "/",
      component: () => import("@/layouts/FrontDeskLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("@/views/dashboard/DashboardView.vue"),
        },
        {
          path: "booking",
          name: "booking",
          component: () => import("@/views/booking/BookingView.vue"),
        },
        {
          path: "orders",
          name: "orders",
          component: () => import("@/views/orders/OrderListView.vue"),
        },
        {
          path: "orders/:id",
          name: "order-detail",
          component: () => import("@/views/orders/OrderDetailView.vue"),
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.restored) await auth.restore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: "login" };
  if (to.name === "login" && auth.isAuthenticated) return { name: "dashboard" };
  return true;
});
export default router;
