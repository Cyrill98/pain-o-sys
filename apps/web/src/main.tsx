import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import './i18n'; // must run before the first render
import './lib/install'; // catch the browser's install event as early as possible
import { router } from './router';
import { AppStatus } from './components/pwa/AppStatus';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AppStatus />
    </QueryClientProvider>
  </StrictMode>,
);
