import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers/app-providers';
import { router } from './app/router/router';
import './i18n';
import './styles/index.css';

const chunkReloadKey = 'feliam:last-chunk-reload';
const chunkReloadCooldownMs = 10_000;

// A user can keep an older deployment open while Vercel replaces its hashed
// JavaScript chunks. Vite emits this event when a lazy route then requests a
// chunk that no longer exists. Reload once so the browser receives the latest
// index and asset manifest instead of showing a failed dynamic-import screen.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  const now = Date.now();
  let lastReload = 0;
  try {
    lastReload = Number(window.sessionStorage.getItem(chunkReloadKey) ?? 0);
  } catch {
    // Storage can be unavailable in restricted browser modes; reload still works.
  }

  if (Number.isFinite(lastReload) && now - lastReload < chunkReloadCooldownMs) return;

  try {
    window.sessionStorage.setItem(chunkReloadKey, String(now));
  } catch {
    // See the storage note above.
  }
  window.location.reload();
});

const root = document.getElementById('root');
if (!root) throw new Error('ApplicationRootMissing');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
