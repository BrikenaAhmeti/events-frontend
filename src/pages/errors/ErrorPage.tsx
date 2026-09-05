import { ShieldAlert, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';

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
