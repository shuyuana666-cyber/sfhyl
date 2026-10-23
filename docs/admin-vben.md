# Admin UI: Vue Vben Admin

The administration app uses the Element Plus flavor of Vue Vben Admin V5 from the upstream [`vbenjs/vue-vben-admin`](https://github.com/vbenjs/vue-vben-admin) repository. The checkout is pinned at commit `c5204a69b8374682c59cb35e7a43d474cf125a82` in `admin-vben/`. V5 is a major-version redesign; this integration starts from its current workspace instead of attempting an in-place upgrade of the former admin shell.

## Workspace and commands

Vben is kept as an independent pnpm workspace because its monorepo requires pnpm 11, while the application root uses pnpm 10. The root scripts delegate to the pinned Vben workspace:

```sh
pnpm admin:vben:install
pnpm admin:dev
pnpm admin:typecheck
pnpm admin:build
```

The Vben workspace requires Node `^22.18.0 || ^24.12.0` and pnpm `11.16.0`. Development uses port `5777` internally; open the admin UI at `http://127.0.0.1:5173/admin/` through the website dev server. Both UIs call the local API through `/api/v1`. Its production bundle is written to `apps/admin-web/dist` for the existing release packaging flow.

## Application integration

- Vben supplies the application shell, layout, navigation, dynamic route registration, tabs, preferences, and access layer.
- The existing SFHYL business pages, request modules, types, and shared UI components are carried into `apps/web-ele/src/views/sfhyl` and `src/sfhyl/legacy` as a migration bridge. The existing `apps/admin-web` source remains available during parity work.
- `src/sfhyl/menu-catalog.ts` maps page routes to backend permission codes. `/auth/me` supplies the signed-in user's permissions; only matching routes are registered and shown.
- Login, token refresh, logout, and current-user lookup use the existing API contract. The development API proxy uses `/api/v1`; uploaded media resolves on the shared website origin through `/uploads/` or `/media/`.
- The admin shell, login screen, and favicon use the website Logo from `/api/v1/public/site` (`settings.branding.logoUrl`). `/brand-logo.jpg` is the fallback. The login screen starts in light mode even when the prior session saved a dark preference; users may switch themes after login.
- The About page's `company-core-strengths` module shows a media placeholder until an image or video is selected in the existing content editor.
- In the media library, **新建文件夹** creates a folder directly inside the current directory (or at the root when browsing the root). The dialog asks only for a name; renaming preserves its current directory.
- Contact page social links are managed under **网站设置 → 社交媒体**: `social.whatsapp`, `social.tiktok`, and `social.facebook`. When `social.whatsapp` is empty, the public page derives a `wa.me` link from **联系方式 → WhatsApp** if a valid number exists. Empty TikTok/Facebook links remain visible but inactive.
- Run `pnpm admin:typecheck` and `pnpm admin:build` after changing the Vben application or its copied business views.

Upgrade the pinned workspace deliberately: review the upstream changes, update the checkout and lockfile together, then rerun `pnpm admin:typecheck` and `pnpm admin:build` before changing the pin.
