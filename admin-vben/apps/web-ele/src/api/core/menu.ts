import type { RouteRecordStringComponent } from '@vben/types';

import { getPermissionRoutes } from '#/sfhyl/menu-catalog';
import { getCurrentUser } from '#/sfhyl/session';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  const user = await getCurrentUser();
  return getPermissionRoutes(user.permissions) as RouteRecordStringComponent[];
}
