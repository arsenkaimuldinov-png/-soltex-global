/** A release on «Обзор» and «Система»: its number, and below it since when it is live. */
import { formatDateTime } from '../../lib/format';

export function ReleaseRef({ release }: { release: { key: string; activatedAt: string | null } | null }) {
  if (!release) return <>Ещё не публиковался</>;
  return (
    <span>
      <span className="font-mono text-xs break-all">{release.key}</span>
      {release.activatedAt ? <span className="block text-xs text-ink-muted">с {formatDateTime(release.activatedAt)}</span> : null}
    </span>
  );
}
