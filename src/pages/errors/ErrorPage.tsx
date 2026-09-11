import { AlertTriangle, RefreshCw, SearchX, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';

const chunkErrorPatterns = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'load failed',
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
}

function isChunkLoadError(error: unknown): boolean {
  const message = errorMessage(error);
  return chunkErrorPatterns.some((pattern) => message.includes(pattern));
}

export function ErrorPage({ code = 404 }: { code?: 403 | 404 }) {
  const { t } = useTranslation('common');
  const Icon = code === 403 ? ShieldAlert : SearchX;
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent">
          <Icon className="size-6" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-[0.18em] text-muted-foreground">{code}</p>
        <h1 className="mt-2 font-display text-4xl">
          {code === 403 ? t('forbidden') : t('notFound')}
        </h1>
        <Button className="mt-7" onClick={() => history.back()}>
          {t('back')}
        </Button>
        <Link className="ml-3 text-sm font-semibold underline" to="/app/dashboard">
          {t('overview')}
        </Link>
      </div>
    </div>
  );
}

export function RouteErrorBoundary() {
  const { t } = useTranslation('common');
  const error = useRouteError();

  if (isRouteErrorResponse(error) && (error.status === 403 || error.status === 404)) {
    return <ErrorPage code={error.status} />;
  }

  const staleChunk = isChunkLoadError(error);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12 text-center text-foreground">
      <div className="max-w-lg rounded-[2rem] border border-border bg-surface-raised p-8 shadow-sm sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-warning/15 text-warning">
          {staleChunk ? <RefreshCw className="size-6" /> : <AlertTriangle className="size-6" />}
        </span>
        <h1 className="mt-6 font-display text-3xl sm:text-4xl">
          {staleChunk ? t('updateAvailable') : t('unexpectedError')}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {staleChunk ? t('updateAvailableDescription') : t('unexpectedErrorDescription')}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => window.location.reload()}>{t('reload')}</Button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold"
            to="/app/dashboard"
          >
            {t('overview')}
          </Link>
        </div>
      </div>
    </main>
  );
}
