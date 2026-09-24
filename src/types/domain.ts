export type Permission =
  | 'EVENT_CREATE'
  | 'EVENT_READ'
  | 'EVENT_EDIT'
  | 'EVENT_DELETE'
  | 'EVENT_PUBLISH'
  | 'DOCUMENT_UPLOAD'
  | 'GUEST_READ'
  | 'GUEST_MANAGE'
  | 'GUEST_IMPORT'
  | 'INVITATION_READ'
  | 'INVITATION_SEND'
  | 'INVITATION_REVOKE'
  | 'TEAM_READ'
  | 'TEAM_MANAGE'
  | 'CLIENT_SETTINGS_MANAGE';

export type Membership = {
  id?: string;
  clientId: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_STAFF';
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  permissions: Permission[];
};

export type CurrentUser = {
  userId: string;
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: 'SUPER_ADMIN' | null;
  memberships: Membership[];
};

export type EventCompleteness = {
  score: number;
  ready: boolean;
  missing: string[];
  warnings: string[];
  recommendations: string[];
};

export type EventSummary = {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  destination: string | null;
  venue: string | null;
  venueAddress: string | null;
  venueDetails: string | null;
  restroomInformation: string | null;
  accessibilityInformation: string | null;
  parkingInformation: string | null;
  wifiInformation: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  status: 'DRAFT' | 'READY' | 'PUBLISHED' | 'CANCELLED' | 'ARCHIVED';
  operationalStatus: 'UNSCHEDULED' | 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED';
  client: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string; email: string };
  capabilities: {
    canEdit: boolean;
    canManageGuests?: boolean;
    canImportGuests?: boolean;
    canSendInvitations?: boolean;
    canRevokeInvitations?: boolean;
    canPublish?: boolean;
    canUploadDocuments?: boolean;
    canDelete: boolean;
    canCancel: boolean;
  };
  completeness: EventCompleteness;
  _count: { guests: number; documents: number; invitations: number };
};

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  category: string | null;
};

export type EventDetail = EventSummary & {
  schedule: ScheduleItem[];
  facts: Array<{ id: string; key: string; value: string }>;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  contactEmail: string | null;
  _count?: { events: number; memberships: number };
};

export type Page<T> = { items: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    platformRole: 'SUPER_ADMIN' | null;
  } | null;
  client: { id: string; name: string } | null;
  event: { id: string; name: string } | null;
};

export type AuditActor = {
  id: string;
  firstName: string;
  lastName: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_STAFF';
};

export type ApiErrorShape = {
  statusCode: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
};
