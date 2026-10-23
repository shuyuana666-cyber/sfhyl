<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useEventListener } from "@vueuse/core";
import type { FormInstance, FormRules } from "element-plus";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import { getTopMenu, initRouter } from "@/router/utils";
import User from "~icons/ri/user-3-line";
import Lock from "~icons/ri/lock-password-line";

defineOptions({ name: "Login" });

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ username: "", password: "", remember: false });
const rules: FormRules = {
  username: [
    { required: true, message: "请输入用户名或邮箱", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, message: "密码至少 8 位", trigger: "blur" }
  ]
};

async function submit(): Promise<void> {
  if (!formRef.value || loading.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    useUserStoreHook().SET_ISREMEMBERED(form.remember);
    await useUserStoreHook().loginByUsername(form);
    await initRouter();
    await router.push(getTopMenu(true)?.path || "/dashboard");
    message("登录成功", { type: "success" });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const query = new URLSearchParams(window.location.search);
  const accessToken = query.get("accessToken");
  const refreshToken = query.get("refreshToken");
  if (!accessToken || !refreshToken) return;
  window.history.replaceState({}, document.title, window.location.pathname);
  loading.value = true;
  try {
    await useUserStoreHook().loginByTokens({ accessToken, refreshToken });
    await initRouter();
    await router.push(getTopMenu(true)?.path || "/dashboard");
  } finally {
    loading.value = false;
  }
});

useEventListener(document, "keydown", event => {
  if (event.key === "Enter") void submit();
});
</script>

<template>
  <main class="login-page">
    <div class="login-shade" />
    <section class="login-brand" aria-label="SFHYL.CN">
      <span class="brand-mark">SF</span>
      <div>
        <strong>SFHYL.CN</strong>
        <span>汽车展示网站运营中心</span>
      </div>
    </section>
    <section class="login-panel">
      <header>
        <p>ADMIN CONSOLE</p>
        <h1>管理员登录</h1>
      </header>
      <el-form ref="formRef" :model="form" :rules="rules" size="large">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            :prefix-icon="User"
            autocomplete="username"
            placeholder="用户名或邮箱"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            :prefix-icon="Lock"
            autocomplete="current-password"
            show-password
            placeholder="密码"
          />
        </el-form-item>
        <div class="login-options">
          <el-checkbox v-model="form.remember">记住登录状态</el-checkbox>
        </div>
        <el-button
          class="login-button"
          type="primary"
          :loading="loading"
          @click="submit"
          >登录</el-button
        >
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  padding: 44px;
  overflow: hidden;
  background: #15191e url("/login-cover.jpg") center / cover no-repeat;
}

.login-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgb(9 13 17 / 76%),
    rgb(9 13 17 / 25%) 62%,
    rgb(9 13 17 / 56%)
  );
}

.login-brand {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  align-items: center;
  align-self: start;
  color: #fff;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  font-weight: 800;
  background: #c72c35;
  border-radius: 4px;
}

.login-brand strong,
.login-brand span {
  display: block;
  letter-spacing: 0;
}

.login-brand strong {
  font-size: 20px;
}

.login-brand div span {
  margin-top: 2px;
  font-size: 12px;
  color: rgb(255 255 255 / 70%);
}

.login-panel {
  position: relative;
  z-index: 1;
  place-self: center end;
  width: min(420px, 100%);
  padding: 34px;
  background: rgb(255 255 255 / 96%);
  border-radius: 6px;
  box-shadow: 0 24px 70px rgb(0 0 0 / 28%);
}

.login-panel header {
  margin-bottom: 28px;
}

.login-panel header p {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: #c72c35;
}

.login-panel h1 {
  margin: 0;
  font-size: 28px;
  color: #17202a;
  letter-spacing: 0;
}

.login-options {
  display: flex;
  justify-content: space-between;
  margin: -2px 0 20px;
}

.login-button {
  width: 100%;
  height: 44px;
}

@media (width <= 720px) {
  .login-page {
    padding: 24px;
    background-position: 38% center;
  }

  .login-brand {
    align-self: start;
  }

  .login-panel {
    place-self: end center;
    padding: 26px 22px;
  }
}
</style>
