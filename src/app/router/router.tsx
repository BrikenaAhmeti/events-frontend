import { lazy, Suspense, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Skeleton } from '../../components/atoms/Skeleton';
import { ProtectedRoute } from '../../features/auth/ProtectedRoute';
import { AppLayout } from '../../layouts/AppLayout';
import { GuestLayout } from '../../layouts/GuestLayout';
import { ErrorPage, RouteErrorBoundary } from '../../pages/errors/ErrorPage';

const load = <T extends Record<string, ComponentType>>(factory: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await factory())[name] }));

const LoginPage = load(() => import('../../pages/auth/LoginPage'), 'LoginPage');
const ForgotPasswordPage = load(
  () => import('../../pages/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ActivationPage = load(() => import('../../pages/auth/ActivationPage'), 'ActivationPage');
const DashboardPage = load(() => import('../../pages/dashboard/DashboardPage'), 'DashboardPage');
const ProfilePage = load(() => import('../../pages/profile/ProfilePage'), 'ProfilePage');
const ClientsPage = load(() => import('../../pages/clients/ClientsPage'), 'ClientsPage');
const ClientDetailPage = load(
  () => import('../../pages/clients/ClientDetailPage'),
  'ClientDetailPage',
);
const TeamPage = load(() => import('../../pages/team/TeamPage'), 'TeamPage');
const EventsPage = load(() => import('../../pages/events/EventsPage'), 'EventsPage');
const CreateEventPage = load(() => import('../../pages/events/CreateEventPage'), 'CreateEventPage');
const EventLayout = load(() => import('../../pages/events/EventLayout'), 'EventLayout');
const EventOverviewPage = load(
  () => import('../../pages/events/EventOverviewPage'),
  'EventOverviewPage',
);
const ConciergePage = load(() => import('../../pages/events/ConciergePage'), 'ConciergePage');
const SchedulePage = load(() => import('../../pages/events/SchedulePage'), 'SchedulePage');
const GuestsPage = load(() => import('../../pages/guests/GuestsPage'), 'GuestsPage');
const DocumentsPage = load(() => import('../../pages/documents/DocumentsPage'), 'DocumentsPage');
const InvitationsPage = load(
  () => import('../../pages/invitations/InvitationsPage'),
  'InvitationsPage',
);
const PublicEventPage = load(() => import('../../pages/guest/PublicEventPage'), 'PublicEventPage');
const InvitationExchangePage = load(
  () => import('../../pages/guest/InvitationExchangePage'),
  'InvitationExchangePage',
);
const GuestEventPage = load(() => import('../../pages/guest/GuestEventPage'), 'GuestEventPage');
function RouteFallback() {
  const { t } = useTranslation('common');
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6" aria-label={t('loadingLabel')}>
      <Skeleton className="h-14 w-64" />
      <Skeleton className="h-36" />
      <Skeleton className="h-72" />
    </div>
  );
}

const suspense = (element: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <Navigate to="/login" replace /> },
      { path: '/login', element: suspense(<LoginPage />) },
      { path: '/forgot-password', element: suspense(<ForgotPasswordPage />) },
      { path: '/activate', element: suspense(<ActivationPage />) },
      { path: '/reset-password', element: suspense(<ActivationPage recovery />) },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/app',
            element: <AppLayout />,
            children: [
              { index: true, element: suspense(<DashboardPage />) },
              { path: 'dashboard', element: suspense(<DashboardPage />) },
              { path: 'profile', element: suspense(<ProfilePage />) },
              { path: 'clients', element: suspense(<ClientsPage />) },
              { path: 'clients/:clientId', element: suspense(<ClientDetailPage />) },
              { path: 'team', element: suspense(<TeamPage />) },
              { path: 'events', element: suspense(<EventsPage />) },
              { path: 'events/new', element: suspense(<CreateEventPage />) },
              {
                path: 'events/:eventId',
                element: suspense(<EventLayout />),
                children: [
                  { index: true, element: suspense(<EventOverviewPage />) },
                  { path: 'concierge', element: suspense(<ConciergePage />) },
                  { path: 'guests', element: suspense(<GuestsPage />) },
                  { path: 'documents', element: suspense(<DocumentsPage />) },
                  { path: 'invitations', element: suspense(<InvitationsPage />) },
                  { path: 'schedule', element: suspense(<SchedulePage />) },
                ],
              },
              { path: 'forbidden', element: suspense(<ErrorPage code={403} />) },
            ],
          },
        ],
      },
      {
        element: <GuestLayout />,
        children: [
          { path: '/e/:slug', element: suspense(<PublicEventPage />) },
          { path: '/i/:invitationToken', element: suspense(<InvitationExchangePage />) },
          { path: '/guest/events/:eventId', element: suspense(<GuestEventPage />) },
        ],
      },
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
  },
]);
