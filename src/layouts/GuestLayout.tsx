import { Outlet } from 'react-router-dom';
import { Logo } from '../components/atoms/Logo';
import { ThemeToggle } from '../components/molecules/ThemeToggle';

export function GuestLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-18 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
