import { useAccessStore } from '@vben/stores';

export function hasPerms(value: string | string[]): boolean {
  if (!value) {
    return false;
  }
  const permissions = useAccessStore().accessCodes;
  if (permissions.includes('*:*:*')) {
    return true;
  }
  const required = Array.isArray(value) ? value : [value];
  return required.every((permission) => permissions.includes(permission));
}
