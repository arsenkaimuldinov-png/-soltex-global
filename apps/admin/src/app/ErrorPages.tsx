import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../components/ui/Layout';

function ErrorView({ title, text }: { title: string; text: string }) {
  useDocumentTitle(title);
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-[13px] text-ink-muted">{text}</p>
      <Link to="/" className="text-[13px] text-accent hover:underline">
        Перейти к обзору
      </Link>
    </div>
  );
}

export const ForbiddenPage = () => <ErrorView title="Недостаточно прав" text="У вашей роли нет доступа к этому разделу. Если он нужен для работы, обратитесь к администратору." />;
export const NotFoundPage = () => <ErrorView title="Страница не найдена" text="Такого раздела нет. Проверьте адрес или воспользуйтесь меню." />;
