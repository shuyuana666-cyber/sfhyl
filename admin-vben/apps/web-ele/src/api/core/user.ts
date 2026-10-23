import type { UserInfo } from '@vben/types';

import { getPermissionRoutes } from '#/sfhyl/menu-catalog';
import { getCurrentUser } from '#/sfhyl/session';

function firstPagePath(
  routes: Array<{
    children?: Array<{ component?: unknown; path: string }>;
    component?: unknown;
    path: string;
  }>,
): string | undefined {
  for (const route of routes) {
    if (route.children?.length) {
      const childPath = firstPagePath(route.children);
      if (childPath) return childPath;
    }
    if (route.component) return route.path;
  }
  return undefined;
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const user = await getCurrentUser();
  const homePath = firstPagePath(
    getPermissionRoutes(user.permissions) as unknown as Array<{
      children?: Array<{ component?: unknown; path: string }>;
      component?: unknown;
      path: string;
    }>,
  );
  return {
    avatar: '',
    desc: user.email,
    homePath: homePath || '/dashboard',
    realName: user.displayName || user.username,
    roles: user.roleCodes,
    token: '',
    userId: user.id,
    username: user.username,
    permissions: user.permissions,
  } as UserInfo;
}
