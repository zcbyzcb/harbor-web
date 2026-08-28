<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ApiError } from "@/api/http";
import { useAuthStore } from "@/stores/auth-store";

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ username: "", password: "" });
const formRef = ref();
const submitting = ref(false);
const errorMessage = ref("");

const rules = {
  username: [{ required: true, message: "请输入员工账号", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid || submitting.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    await auth.signIn(form.username, form.password);
    form.password = "";
    await router.replace({ name: "dashboard" });
  } catch (error) {
    form.password = "";
    errorMessage.value =
      error instanceof ApiError ? error.message : "登录请求失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card" aria-labelledby="login-title">
      <p class="eyebrow">Harbor Hotel</p>
      <h1 id="login-title">泊岸酒店前台</h1>
      <p class="subtitle">登录后可处理预订、入住和订单查询。</p>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item label="员工账号" prop="username">
          <el-input
            v-model.trim="form.username"
            maxlength="64"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            maxlength="128"
            show-password
            autocomplete="current-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button
          class="submit-button"
          type="primary"
          native-type="submit"
          :loading="submitting"
        >
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: linear-gradient(135deg, #e8f3ff, #f7f9fc);
}
.login-card {
  width: min(100%, 400px);
  padding: 36px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 50px rgb(31 41 55 / 12%);
}
.eyebrow {
  margin: 0;
  color: #2f78c4;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1 {
  margin: 12px 0 8px;
  font-size: 28px;
}
.subtitle {
  margin: 0 0 24px;
  color: #6b7280;
}
.el-alert {
  margin-bottom: 16px;
}
.submit-button {
  width: 100%;
  margin-top: 8px;
}
</style>
