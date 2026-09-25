import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { ConciergeWorkspace } from '../../components/organisms/ConciergeWorkspace';
import { CompletenessPanel } from '../../features/events/CompletenessPanel';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import type { EventOutletContext } from './EventLayout';
import { apiClient } from '../../lib/api/api-client';
import { invitationKeys } from '../../lib/api/query-keys';

export function ConciergePage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { data: user } = useCurrentUser();
  const access = useQuery({
    queryKey: invitationKeys.access(event.id),
    queryFn: ({ signal }) =>
      apiClient.get<{ url: string; qrSvg: string }>(
        `/events/${event.id}/invitations/general-access`,
        signal,
      ),
    enabled: event.status === 'PUBLISHED',
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <ConciergeWorkspace
        eventId={event.id}
        eventStatus={event.status}
        ready={event.completeness.ready}
        guestCount={event._count.guests}
        allowPlanning={Boolean(user && event.capabilities.canEdit)}
        allowGuestManage={Boolean(user && (event.capabilities.canManageGuests ?? event.capabilities.canEdit))}
        allowGuestImport={Boolean(user && (event.capabilities.canImportGuests ?? event.capabilities.canEdit))}
        allowPublish={Boolean(user && (event.capabilities.canPublish ?? event.capabilities.canEdit))}
        allowUpload={Boolean(
          user && can(user, 'DOCUMENT_UPLOAD', event.clientId) &&
          (event.capabilities.canUploadDocuments ?? event.capabilities.canEdit),
        )}
        shareAccess={access.data}
      />
      <aside>
        <CompletenessPanel completeness={event.completeness} />
      </aside>
    </div>
  );
}
