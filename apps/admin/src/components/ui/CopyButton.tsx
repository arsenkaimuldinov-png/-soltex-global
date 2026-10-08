import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';

export function CopyButton({ text, label = 'Копировать' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      icon={done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? 'Скопировано' : label}
    </Button>
  );
}
