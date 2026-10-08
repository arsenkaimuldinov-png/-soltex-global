import { PageHeader } from '../../components/ui/Layout';
import { PasswordCard } from './PasswordCard';
import { ProfileCard } from './ProfileCard';
import { SecondFactorsCard } from './SecondFactorsCard';
import { SessionsCard } from './SessionsCard';

export function AccountPage() {
  return (
    <>
      <PageHeader title="Профиль и безопасность" crumbs={[{ label: 'Обзор', to: '/' }, { label: 'Профиль и безопасность' }]} />
      <div className="space-y-4">
        <ProfileCard />
        <SecondFactorsCard />
        <PasswordCard />
        <SessionsCard />
      </div>
    </>
  );
}
