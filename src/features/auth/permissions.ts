import type { CurrentUser, Permission } from '../../types/domain';

export const can = (user: CurrentUser, permission: Permission, clientId?: string): boolean => {
  if (user.platformRole === 'SUPER_ADMIN') return true;
  const membership = clientId
    ? user.memberships.find((entry) => entry.clientId === clientId && entry.status === 'ACTIVE')
    : user.memberships.find((entry) => entry.status === 'ACTIVE');
  if (!membership) return false;
  return membership.role === 'CLIENT_ADMIN' || permission === 'EVENT_READ' || membership.permissions.includes(permission);
};

export const activeClientId = (user: CurrentUser): string | undefined =>
  user.memberships.find(({ status }) => status === 'ACTIVE')?.clientId;
