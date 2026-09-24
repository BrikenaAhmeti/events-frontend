import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../components/atoms/Spinner';
import { apiClient } from '../../lib/api/api-client';
import { GuestAccessState, guestAccessStateFromError } from './GuestAccessState';

export function InvitationExchangePage() {
  const { invitationToken = '' } = useParams();
  const { t } = useTranslation('guest');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const exchange = useQuery({
    queryKey: ['personal-invitation-exchange', invitationToken],
    queryFn: () => apiClient.post<{ eventId: string }>(
      '/public/invitations/exchange',
      { token: invitationToken },
      { skipRefresh: true },
    ),
    enabled: Boolean(invitationToken),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  });

  useEffect(() => {
    if (!exchange.data) return;
    queryClient.removeQueries({ queryKey: ['guest-event'] });
    queryClient.removeQueries({ queryKey: ['concierge'] });
    void navigate(`/guest/events/${exchange.data.eventId}`, { replace: true });
  }, [exchange.data, navigate, queryClient]);

  const deniedState = guestAccessStateFromError(exchange.error);
  if (deniedState) return <GuestAccessState state={deniedState} />;
  if (!invitationToken || exchange.isError) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-4xl">{t('invitationUnavailable')}</h1>
          <p className="mt-3 text-muted-foreground">{t('expired')}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Spinner label={t('invitation')} />
    </div>
  );
}
