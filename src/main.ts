import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import "./styles/base.css";
import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth-store";
import { onUnauthorized } from "./api/http";
const pinia = createPinia();
const app = createApp(App).use(pinia);
onUnauthorized(() => {
  useAuthStore(pinia).clear();
  if (router.currentRoute.value.path !== "/login")
    void router.replace("/login");
});
app.use(router).use(ElementPlus, { locale: zhCn }).mount("#app");
