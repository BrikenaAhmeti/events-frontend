export const authKeys = { all: ['auth'] as const, me: () => [...authKeys.all, 'me'] as const };
export const clientKeys = {
  all: ['clients'] as const,
  list: () => [...clientKeys.all, 'list'] as const,
  detail: (id: string) => [...clientKeys.all, id] as const,
};
export const teamKeys = {
  all: ['team'] as const,
  list: (clientId: string) => [...teamKeys.all, clientId] as const,
};
export const eventKeys = {
  all: ['events'] as const,
  list: (filters?: Record<string, string>) => [...eventKeys.all, 'list', filters] as const,
  detail: (id: string) => [...eventKeys.all, id] as const,
};
export const guestKeys = {
  all: ['guests'] as const,
  list: (eventId: string) => [...guestKeys.all, eventId] as const,
};
export const documentKeys = {
  all: ['documents'] as const,
  list: (eventId: string) => [...documentKeys.all, eventId] as const,
};
export const invitationKeys = {
  all: ['invitations'] as const,
  list: (eventId: string) => [...invitationKeys.all, eventId] as const,
  access: (eventId: string) => [...invitationKeys.all, eventId, 'access'] as const,
};
