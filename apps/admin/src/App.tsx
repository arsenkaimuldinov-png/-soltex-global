/**
 * Admin application: providers and routes (docs/admin-ui.md §3).
 * Screens behind the shell are loaded on demand (smaller first load of the sign-in page).
 * Every route only decides what to render; the API authorises every request on its own.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { isApiError } from './lib/api/client';
import { HeldCodesProvider } from './lib/held-codes';
import { SessionSync } from './lib/session';
import { StepUpProvider } from './lib/step-up';
import { ToastProvider } from './components/ui/Toast';
import { NotFoundPage } from './app/ErrorPages';
import { Authenticated, FullScreenLoading, PublicOnly, RequirePermission, StepRoute } from './app/guards';
import { Shell } from './app/Shell';
import { LoginPage } from './features/auth/LoginPage';
import { MfaPage } from './features/auth/MfaPage';
import { ForgotPasswordPage, ResetPasswordPage } from './features/auth/PasswordResetPages';
import { SetupMfaPage } from './features/auth/SetupMfaPage';
import { OverviewPage } from './features/overview/OverviewPage';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 4xx answers are final (permissions, validation); only network and 5xx errors are retried.
        retry: (count, error) => count < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}

/** Providers shared by every route (step-up and toasts are needed during enrollment too). */
function Root() {
  return (
    <ToastProvider>
      <HeldCodesProvider>
        <StepUpProvider>
          <SessionSync />
          <Outlet />
        </StepUpProvider>
      </HeldCodesProvider>
    </ToastProvider>
  );
}

export const routes = [
  {
    element: <Root />,
    // Shown while a lazily loaded screen is fetched on the first page load.
    hydrateFallbackElement: <FullScreenLoading />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      // The reset link works whatever the session state; the token stays in the URL fragment.
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/login/mfa', element: <StepRoute step="mfa_required" render={(view) => <MfaPage view={view} />} /> },
      { path: '/setup-mfa', element: <StepRoute step="mfa_enrollment_required" render={(view) => <SetupMfaPage view={view} />} /> },
      {
        path: '/',
        element: (
          <Authenticated>
            <Shell />
          </Authenticated>
        ),
        children: [
          { index: true, element: <OverviewPage /> },
          {
            path: 'content/pages',
            lazy: async () => {
              const { PagesListPage } = await import('./features/content/PagesListPage');
              return { element: <RequirePermission permission="content.read"><PagesListPage /></RequirePermission> };
            },
          },
          {
            path: 'content/pages/:id',
            lazy: async () => {
              const { PageEditorPage } = await import('./features/content/PageEditor');
              return { element: <RequirePermission permission="content.read"><PageEditorPage /></RequirePermission> };
            },
          },
          {
            path: 'content/:collection',
            lazy: async () => {
              const { ContentListPageRoute } = await import('./features/content/ContentListPage');
              return { element: <RequirePermission permission="content.read"><ContentListPageRoute /></RequirePermission> };
            },
          },
          {
            path: 'content/:collection/:id',
            lazy: async () => {
              const { CollectionEditorPage } = await import('./features/content/CollectionEditor');
              return { element: <RequirePermission permission="content.read"><CollectionEditorPage /></RequirePermission> };
            },
          },
          { path: 'account', lazy: async () => ({ Component: (await import('./features/account/AccountPage')).AccountPage }) },
          {
            path: 'admin/users',
            lazy: async () => {
              const { UsersPage } = await import('./features/users/UsersPage');
              return { element: <RequirePermission permission="users.manage"><UsersPage /></RequirePermission> };
            },
          },
          {
            path: 'admin/audit',
            lazy: async () => {
              const { AuditPage } = await import('./features/audit/AuditPage');
              return { element: <RequirePermission permission="audit.read"><AuditPage /></RequirePermission> };
            },
          },
          {
            path: 'admin/system',
            lazy: async () => {
              const { SystemPage } = await import('./features/system/SystemPage');
              return { element: <RequirePermission permission="system.read"><SystemPage /></RequirePermission> };
            },
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export function App({ queryClient }: { queryClient: QueryClient }) {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
