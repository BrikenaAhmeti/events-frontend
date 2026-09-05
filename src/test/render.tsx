import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../app/providers/theme-provider';
import { ToastProvider } from '../app/providers/toast-provider';

export function renderApp(element: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{element}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
    options,
  );
}
