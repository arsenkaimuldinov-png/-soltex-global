import type { ReactNode } from 'react';
import { useDocumentTitle } from '../../components/ui/Layout';

/** Centered card for sign-in, second factor, enrollment and password screens. */
export function AuthLayout({ title, description, children, wide }: { title: string; description?: ReactNode; children: ReactNode; wide?: boolean }) {
  useDocumentTitle(title);
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12 sm:items-center">
      <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-sm'}>
        <p className="mb-6 text-center text-xs font-semibold tracking-[0.2em] text-accent">SOLTEX ADMIN</p>
        <div className="rounded-lg border border-line bg-surface px-6 py-6 shadow-sm">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          {description ? <div className="mt-1.5 text-[13px] text-ink-muted">{description}</div> : null}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
