import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Rendered for every unknown URL. The static build writes it to 404.html (and /<locale>/404.html);
 * the web server returns it with HTTP status 404 (see docs/deployment.md).
 */
export const NotFoundPage: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      <PageHeader
        badgeNumber="404"
        badgeLabel={t('notFound.badge')}
        title={t('notFound.title')}
        description={t('notFound.description')}
        primaryAction={{ label: t('notFound.backHome'), href: '/' }}
      />
    </div>
  );
};
