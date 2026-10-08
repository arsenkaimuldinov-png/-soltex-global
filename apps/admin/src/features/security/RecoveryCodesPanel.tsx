/**
 * Recovery codes are shown exactly once (admin-auth.md §4). The user copies or downloads them
 * and confirms before continuing; they are never stored by the browser.
 */
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';

export function RecoveryCodesPanel({ codes, email, onDone, doneLabel = 'Продолжить' }: { codes: string[]; email: string; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const text = useMemo(
    () =>
      [
        'Soltex Global Admin: резервные коды',
        `Учётная запись: ${email}`,
        '',
        ...codes,
        '',
        'Каждый код действует один раз. Храните коды отдельно от устройства с ключом доступа.',
      ].join('\n'),
    [codes, email]
  );
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soltex-admin-recovery-codes.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <Alert tone="warn" title="Сохраните резервные коды сейчас">
        Они понадобятся, если вы потеряете устройство с ключом доступа или приложением. Коды показываются только один раз.
      </Alert>
      <ol className="grid grid-cols-1 gap-1.5 rounded-md border border-line bg-subtle p-3 font-mono text-[13px] sm:grid-cols-2" aria-label="Резервные коды">
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="Скопировать коды" />
        <Button size="sm" icon={<Download className="size-3.5" aria-hidden />} onClick={download}>
          Скачать .txt
        </Button>
      </div>
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>Я сохранил коды в надёжном месте</span>
      </label>
      <Button variant="primary" disabled={!saved} onClick={onDone} className="w-full sm:w-auto">
        {doneLabel}
      </Button>
    </div>
  );
}
