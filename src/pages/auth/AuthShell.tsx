import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/atoms/Logo';
import { ThemeToggle } from '../../components/molecules/ThemeToggle';

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth');
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)]">
      <section className="hidden border-r border-border bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
        <Logo />
        <div className="my-auto max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
            {t('operationsEyebrow')}
          </p>
          <h1 className="mt-5 font-display text-6xl leading-[1.04] tracking-tight">
            {t('operationsTitle')}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            {t('operationsDescription')}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{t('operationsFooter')}</p>
      </section>
      <section className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16 sm:px-10">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-md lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
          {children}
        </div>
      </section>
    </main>
  );
}
