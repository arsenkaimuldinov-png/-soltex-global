import React from 'react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { usePage } from '../content/useContent';

/**
 * Privacy Policy / Terms of Use. Routed only when the page is PUBLISHED in the content
 * (src/content/seed/pages.json → a future admin). Until Soltex supplies approved legal text the
 * pages stay drafts: no route, no sitemap entry, and the footer keeps its approved behaviour.
 */
export const LegalPage: React.FC<{ pageKey: 'privacy' | 'terms' }> = ({ pageKey }) => {
  const { header, page } = usePage(pageKey);
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      <PageHeader {...pageHeaderProps(header)} />
      <section className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-12 space-y-5 text-base text-[#334439] leading-relaxed">
          {(page.body ?? []).map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </section>
    </div>
  );
};
