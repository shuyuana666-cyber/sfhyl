<script setup lang="ts">
defineOptions({
  name: "PermissionPage"
});
</script>

<template>
  <div class="permission-page">
    <p class="mb-2!">角色和功能权限由服务端账号及 RBAC 配置决定。</p>
    <el-card shadow="never">
      <div class="card-header">
        <strong>权限视图</strong>
        <p>请使用对应管理员账号登录；服务端授权结果控制菜单和 API 操作。</p>
      </div>
    </el-card>
  </div>
</template>
