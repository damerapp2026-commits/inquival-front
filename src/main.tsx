import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './app/providers/AuthProvider';
import { AppRoutes } from './app/routes/AppRoutes';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import './index.css';

registerSW({ immediate: true });

// Si un chunk lazy quedó desactualizado (nuevo deploy mientras la pestaña
// seguía abierta), Vite no puede cargarlo y la app se queda en blanco.
// En ese caso recargamos para traer la versión actual.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppRoutes />
            <Toaster position="top-right" />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
