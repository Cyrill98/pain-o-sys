import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { LangLayout } from './routes/LangLayout';
import { RootRedirect } from './routes/RootRedirect';
import { Home } from './routes/Home';
import { NotFound } from './routes/NotFound';
import { RouteFallback } from './routes/RouteFallback';

// The home page loads immediately; every other page is its own chunk, fetched when opened
// (and precached by the service worker for offline use). Guests never download the admin.
const page =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] });

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    path: '/:lng',
    element: <LangLayout />,
    hydrateFallbackElement: <RouteFallback />,
    children: [
      { index: true, element: <Home /> },
      { path: 'request', lazy: page(() => import('./routes/Request'), 'Request') },
      { path: 'privacy', lazy: page(() => import('./routes/Privacy'), 'Privacy') },
      { path: 'admin/login', lazy: page(() => import('./routes/admin/AdminLogin'), 'AdminLogin') },
      {
        path: 'admin',
        lazy: page(() => import('./routes/admin/RequireAdmin'), 'RequireAdmin'),
        children: [
          {
            lazy: page(() => import('./routes/admin/AdminLayout'), 'AdminLayout'),
            children: [
              {
                index: true,
                lazy: page(() => import('./routes/admin/AdminRequests'), 'AdminRequests'),
              },
              {
                path: 'requests/:id',
                lazy: page(() => import('./routes/admin/AdminRequestDetail'), 'AdminRequestDetail'),
              },
              {
                path: 'colors',
                lazy: page(() => import('./routes/admin/AdminColors'), 'AdminColors'),
              },
              {
                path: 'settings',
                lazy: page(() => import('./routes/admin/AdminSettings'), 'AdminSettings'),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
