import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api/api-client';
import { Skeleton } from '../../components/atoms/Skeleton';
import { useCurrentUser } from './use-current-user';

export function ProtectedRoute() {
  const { t } = useTranslation('common');
  const user = useCurrentUser();
  const location = useLocation();
  if (user.isLoading)
    return (
      <div
        className="mx-auto grid min-h-screen max-w-5xl place-items-center p-6"
        aria-label={t('loadingLabel')}
      >
        <div className="w-full space-y-4">
          <Skeleton className="h-12 w-52" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  if (user.error instanceof ApiError && user.error.response.statusCode === 401)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
