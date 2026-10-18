import React from 'react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { usePage } from '../content/useContent';

/** A body paragraph that starts with "## " is a section heading (docs/admin-content.md, legal pages). */
export const legalHeading = (paragraph: string): string | null => (paragraph.startsWith('## ') ? paragraph.slice(3).trim() : null);

/**
 * Privacy Policy / Terms of Use. Routed only when the page is PUBLISHED in the content (seed or
 * admin). The body is plain paragraphs; "## " marks a section heading — the only formatting, so
 * the layout of the page cannot be broken from the editor.
 */
export const LegalPage: React.FC<{ pageKey: 'privacy' | 'terms' }> = ({ pageKey }) => {
  const { header, page } = usePage(pageKey);
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      <PageHeader {...pageHeaderProps(header)} />
      <section className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-12 space-y-5 text-base text-[#334439] leading-relaxed">
          {(page.body ?? []).map((paragraph, idx) => {
            const heading = legalHeading(paragraph);
            return heading ? (
              <h2 key={idx} className="pt-6 text-xl lg:text-2xl font-bold text-[#16211B] tracking-tight">
                {heading}
              </h2>
            ) : (
              <p key={idx}>{paragraph}</p>
            );
          })}
        </div>
      </section>
    </div>
  );
};
