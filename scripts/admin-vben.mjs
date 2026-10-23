import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vbenRoot = path.join(projectRoot, "admin-vben");
const action = process.argv[2];

const actions = {
  build: ["--filter", "@vben/web-ele", "build"],
  dev: ["--filter", "@vben/web-ele", "dev"],
  install: ["install", "--frozen-lockfile"],
  lint: [
    "exec",
    "eslint",
    "apps/web-ele/src/api/core/auth.ts",
    "apps/web-ele/src/api/core/menu.ts",
    "apps/web-ele/src/api/core/user.ts",
    "apps/web-ele/src/api/request.ts",
    "apps/web-ele/src/layouts/basic.vue",
    "apps/web-ele/src/main.ts",
    "apps/web-ele/src/preferences.ts",
    "apps/web-ele/src/router/routes/core.ts",
    "apps/web-ele/src/store/auth.ts",
    "apps/web-ele/src/views/_core/authentication/login.vue",
    "apps/web-ele/src/bootstrap.ts",
    "apps/web-ele/src/layouts/auth.vue",
    "apps/web-ele/src/views/sfhyl/dashboard/index.vue",
    "apps/web-ele/src/views/sfhyl/vehicle/index.vue",
    "apps/web-ele/src/views/sfhyl/vehicle/form.vue",
    "apps/web-ele/src/views/sfhyl/system/*.vue",
    "apps/web-ele/src/views/sfhyl/permission/*.vue",
    "apps/web-ele/src/views/sfhyl/homepage/*.vue",
    "apps/web-ele/src/views/sfhyl/homepage/useHomepageContentEditor.ts",
    "apps/web-ele/src/views/sfhyl/vehicle/catalog.vue",
    "apps/web-ele/src/views/sfhyl/ui-route-meta.d.ts",
    "apps/web-ele/src/sfhyl/legacy/components/PageLoadState/index.vue",
    "apps/web-ele/src/sfhyl/legacy/composables/usePageLoad.ts",
    "apps/web-ele/src/sfhyl/legacy/utils/confirm-action.ts",
    "apps/web-ele/src/sfhyl/legacy/utils/action-feedback.ts",
    "apps/web-ele/src/sfhyl/legacy/utils/http/error-message.ts",
    "apps/web-ele/src/views/sfhyl/media/index.vue",
    "apps/web-ele/src/views/sfhyl/media/MediaAssetCard.vue",
    "apps/web-ele/src/sfhyl/legacy/components/RequestError/index.vue",
    "apps/web-ele/src/sfhyl/legacy/components/MediaPicker/index.vue",
    "apps/web-ele/src/sfhyl/adapters/auth.ts",
    "apps/web-ele/src/sfhyl/menu-catalog.ts",
    "apps/web-ele/src/sfhyl/session.ts",
    "apps/web-ele/vite.config.ts",
    "--max-warnings",
    "0",
  ],
  preview: ["--filter", "@vben/web-ele", "preview"],
  typecheck: ["--filter", "@vben/web-ele", "typecheck"],
};

const args = actions[action];
if (!args) {
  console.error(
    `Usage: node scripts/admin-vben.mjs <${Object.keys(actions).join("|")}>`,
  );
  process.exit(2);
}

const command = process.platform === "win32" ? "corepack.cmd" : "corepack";
const result = spawnSync(command, ["pnpm", ...args], {
  cwd: vbenRoot,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (action === "lint") {
  const legacyResult = spawnSync(
    command,
    ["pnpm", "--filter", "@sfhyl/admin-web", "lint:check"],
    {
      cwd: projectRoot,
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );
  if (legacyResult.error) {
    console.error(legacyResult.error.message);
    process.exit(1);
  }
  if (legacyResult.status !== 0) {
    process.exit(legacyResult.status ?? 1);
  }
}

if (action === "typecheck") {
  const uiResult = spawnSync(
    command,
    [
      "pnpm",
      "exec",
      "vue-tsc",
      "--noEmit",
      "--skipLibCheck",
      "-p",
      "apps/web-ele/tsconfig.ui.json",
    ],
    {
      cwd: vbenRoot,
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );
  if (uiResult.error) {
    console.error(uiResult.error.message);
    process.exit(1);
  }
  if (uiResult.status !== 0) process.exit(uiResult.status ?? 1);
  const legacyResult = spawnSync(
    command,
    ["pnpm", "--filter", "@sfhyl/admin-web", "typecheck"],
    {
      cwd: projectRoot,
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );
  if (legacyResult.error) {
    console.error(legacyResult.error.message);
    process.exit(1);
  }
  process.exit(legacyResult.status ?? 1);
}

process.exit(0);
