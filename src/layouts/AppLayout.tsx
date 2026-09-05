import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, Home, LogOut, Menu, UserRound, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../components/atoms/Logo';
import { ThemeToggle } from '../components/molecules/ThemeToggle';
import { activeClientId, can } from '../features/auth/permissions';
import { useCurrentUser } from '../features/auth/use-current-user';
import { apiClient } from '../lib/api/api-client';
import { authKeys } from '../lib/api/query-keys';

type NavigationItem = { to: string; label: string; icon: typeof Home; show: boolean };

function Navigation({ close }: { close?: () => void }) {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const clientId = user ? activeClientId(user) : undefined;
  const items: NavigationItem[] = user
    ? [
        { to: '/app/dashboard', label: t('overview'), icon: Home, show: true },
        { to: '/app/profile', label: t('profile'), icon: UserRound, show: true },
        {
          to: '/app/clients',
          label: t('clients'),
          icon: Building2,
          show: user.platformRole === 'SUPER_ADMIN',
        },
        {
          to: `/app/events${clientId ? `?clientId=${clientId}` : ''}`,
          label: t('events'),
          icon: CalendarDays,
          show: can(user, 'EVENT_READ', clientId),
        },
        {
          to: `/app/team${clientId ? `?clientId=${clientId}` : ''}`,
          label: t('team'),
          icon: Users,
          show: can(user, 'TEAM_READ', clientId),
        },
      ]
    : [];
  return (
    <nav aria-label={t('primaryNavigation')} className="space-y-1">
      {items
        .filter(({ show }) => show)
        .map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={close}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-sidebar-foreground text-black' : 'text-sidebar-foreground hover:bg-black'}`
            }
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </NavLink>
        ))}
    </nav>
  );
}

function UserCard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: () => apiClient.post<void>('/auth/logout'),
    onSettled: () => {
      apiClient.clearCsrf();
      queryClient.removeQueries({ queryKey: authKeys.all });
      void navigate('/login', { replace: true });
    },
  });
  if (!user) return null;
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <ThemeToggle />
      <div className="flex items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
          aria-hidden
        >
          {user.firstName.charAt(0)}
          {user.lastName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
          aria-label={t('signOut')}
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Logo />
        <div className="mt-10 flex-1">
          <Navigation />
        </div>
        <UserCard />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <Logo />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg hover:bg-muted"
            onClick={() => setMobileOpen(true)}
            aria-label={t('menu')}
          >
            <Menu className="size-5" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
      {mobileOpen && (
        <MobileDrawer close={() => setMobileOpen(false)}>
          <Navigation close={() => setMobileOpen(false)} />
          <div className="mt-auto">
            <UserCard />
          </div>
        </MobileDrawer>
      )}
    </div>
  );
}

function MobileDrawer({ close, children }: { close: () => void; children: ReactNode }) {
  const { t } = useTranslation('common');
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t('navigationMenu')}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={close}
        aria-label={t('closeNavigation')}
      />
      <aside className="relative flex h-full w-[min(88vw,20rem)] flex-col bg-sidebar p-5 text-sidebar-foreground">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg hover:bg-muted"
            onClick={close}
            aria-label={t('closeNavigation')}
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
