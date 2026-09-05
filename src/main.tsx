import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers/app-providers';
import { router } from './app/router/router';
import './i18n';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('ApplicationRootMissing');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
