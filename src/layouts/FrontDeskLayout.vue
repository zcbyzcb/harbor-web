<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth-store";
import { messageOf } from "@/api/http";
import { hotelApi } from "@/api/hotel-api";
const auth = useAuthStore();
const router = useRouter();
const date = ref("");
const error = ref("");
const leaving = ref(false);
onMounted(async () => {
  try {
    date.value = (await hotelApi.context()).hotelDate;
  } catch (e) {
    error.value = messageOf(e);
  }
});
async function signOut() {
  if (leaving.value) return;
  leaving.value = true;
  error.value = "";
  try {
    await auth.signOut();
    await router.replace("/login");
  } catch (e) {
    error.value = `退出未确认：${messageOf(e)}`;
  } finally {
    leaving.value = false;
  }
}
</script>
<template>
  <div class="workspace">
    <aside class="sidebar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">泊</span><span>泊岸酒店<small>HARBOR · FRONT DESK</small></span>
      </RouterLink>
      <div class="nav-label">前台工作台</div>
      <nav aria-label="主导航">
        <RouterLink to="/" exact-active-class="selected">今日概览</RouterLink><RouterLink to="/booking" active-class="selected">
          房型与预订
        </RouterLink><RouterLink to="/orders" active-class="selected">订单管理</RouterLink>
      </nav>
      <div class="sidebar-foot">
        单酒店 · 前台员工端<br />每晚 12:00 至次日 12:00
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <span>{{ date || "酒店营业日" }}</span>
        <div>
          {{ auth.employee?.displayName
          }}<el-button text :loading="leaving" @click="signOut">
            退出登录
          </el-button>
        </div>
      </header>
      <main class="content">
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
        /><RouterView :key="$route.fullPath" />
      </main>
    </div>
  </div>
</template>
