/**
 * Inputs of the content editors, one per field kind (model.ts). Structured lists are edited item by
 * item (add, move, remove) — never as raw JSON.
 */
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { SEO_DESCRIPTION_RECOMMENDED_MAX, SEO_DESCRIPTION_RECOMMENDED_MIN, SEO_TITLE_RECOMMENDED_MAX } from '@soltex/core/seo';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { cx } from '../../components/ui/cx';
import type { FieldDef } from './model';
import type { LabelValueItem, PatentInfoForm, TextItem, TitleDescItem } from './form';
import { move } from './form';
import { MediaPicker, MediaSummary, useMedia } from './media';

export interface FieldProps<T = unknown> {
  def: FieldDef;
  value: T;
  onChange: (v: T) => void;
  error?: string;
  disabled?: boolean;
  /** Extra line under the field (e.g. why it is read-only). */
  note?: ReactNode;
}

const textarea =
  'block w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none disabled:bg-subtle disabled:text-ink-muted';

/** Character counter; SEO texts also show the recommended range (review §J). */
export function Counter({ name, length, max }: { name: string; length: number; max?: number }) {
  let note = '';
  let warn = false;
  if (name === 'seoMetaTitle' && length > SEO_TITLE_RECOMMENDED_MAX) {
    note = ` · рекомендуется до ${SEO_TITLE_RECOMMENDED_MAX}`;
    warn = true;
  }
  if (name === 'seoMetaDescription' && length > 0 && (length < SEO_DESCRIPTION_RECOMMENDED_MIN || length > SEO_DESCRIPTION_RECOMMENDED_MAX)) {
    note = ` · рекомендуется ${SEO_DESCRIPTION_RECOMMENDED_MIN}–${SEO_DESCRIPTION_RECOMMENDED_MAX}`;
    warn = true;
  }
  return (
    <span className={cx('text-xs tabular-nums', warn ? 'font-medium text-warn' : 'text-ink-faint')} aria-live="polite">
      {length}
      {max ? ` / ${max}` : ''}
      {note}
    </span>
  );
}

function Labeled({ def, error, note, children, counter }: { def: FieldDef; error?: string; note?: ReactNode; counter?: ReactNode; children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode }) {
  return (
    <Field label={def.label} hint={def.hint} error={error}>
      {(ids) => (
        <>
          {children(ids)}
          {counter || note ? (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-xs text-ink-muted">{note}</div>
              {counter}
            </div>
          ) : null}
        </>
      )}
    </Field>
  );
}

export function TextField({ def, value, onChange, error, disabled, note }: FieldProps<string>) {
  const multiline = def.multiline || def.kind === 'text' || def.kind === 'textNull';
  const v = value ?? '';
  return (
    <Labeled def={def} error={error} note={note} counter={def.max ? <Counter name={def.name} length={v.length} max={def.max} /> : null}>
      {({ id, describedBy, invalid }) =>
        multiline ? (
          <textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={v}
            rows={def.kind === 'text' || def.kind === 'textNull' ? 5 : 2}
            onChange={(e) => onChange(e.target.value)}
            className={cx(textarea, invalid ? 'border-danger' : 'border-line-strong')}
          />
        ) : (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={disabled}
            value={v}
            inputMode={def.kind === 'position' ? 'numeric' : undefined}
            spellCheck={def.kind === 'slug' || def.kind === 'code' || def.kind === 'codeNull' ? false : undefined}
            className={def.kind === 'slug' || def.kind === 'code' || def.kind === 'codeNull' ? 'font-mono' : undefined}
            onChange={(e) => onChange(def.kind === 'slug' ? e.target.value.toLowerCase() : e.target.value)}
          />
        )
      }
    </Labeled>
  );
}

export function PositionField(props: FieldProps<number>) {
  return <TextField {...props} value={String(props.value ?? '')} onChange={(v) => props.onChange(v === '' ? (NaN as number) : Number(v))} />;
}

export function BoolField({ def, value, onChange, disabled }: FieldProps<boolean>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-start gap-2 text-[13px]">
        <input id={id} type="checkbox" className="mt-0.5 size-4 accent-accent" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <span className="font-medium text-ink">{def.label}</span>
          {def.hint ? <span className="block text-xs text-ink-muted">{def.hint}</span> : null}
        </span>
      </label>
    </div>
  );
}

export function EnumField({ def, value, onChange, disabled, error }: FieldProps<string>) {
  return (
    <Labeled def={def} error={error}>
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} invalid={invalid} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Не указан</option>
          {def.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Labeled>
  );
}

export function PlacementsField({ def, value, onChange, disabled, error }: FieldProps<string[]>) {
  const list = value ?? [];
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-ink">{def.label}</legend>
      <div className="flex flex-wrap gap-4">
        {def.options!.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              disabled={disabled}
              checked={list.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? def.options!.map((x) => x.value).filter((v) => v === o.value || list.includes(v)) : list.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

function ItemTools({ index, count, onMove, onRemove, disabled, label }: { index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void; disabled?: boolean; label: string }) {
  if (disabled) return null;
  return (
    <div className="flex shrink-0 items-start gap-0.5">
      <button type="button" className="rounded p-1 text-ink-muted hover:bg-subtle disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`${label} ${index + 1}: выше`}>
        <ArrowUp className="size-3.5" aria-hidden />
      </button>
      <button type="button" className="rounded p-1 text-ink-muted hover:bg-subtle disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`${label} ${index + 1}: ниже`}>
        <ArrowDown className="size-3.5" aria-hidden />
      </button>
      <button type="button" className="rounded p-1 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={onRemove} aria-label={`${label} ${index + 1}: удалить`}>
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function ListShell({ def, error, children, onAdd, disabled, nullable, isNull, onToggleNull, count }: {
  def: FieldDef;
  error?: string;
  children: ReactNode;
  onAdd: () => void;
  disabled?: boolean;
  nullable?: boolean;
  isNull?: boolean;
  onToggleNull?: (on: boolean) => void;
  count: number;
}) {
  return (
    <fieldset className="space-y-2" aria-invalid={error ? true : undefined}>
      <legend className="text-[13px] font-medium text-ink">
        {def.label} {!isNull ? <span className="font-normal text-ink-muted">· {count}</span> : null}
      </legend>
      {def.hint ? <p className="text-xs text-ink-muted">{def.hint}</p> : null}
      {nullable && isNull ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-ink-muted">
          Блок не показывается на сайте.
          {!disabled ? (
            <Button size="sm" onClick={() => onToggleNull?.(true)} icon={<Plus className="size-3.5" aria-hidden />}>
              Добавить блок
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ol className="space-y-2">{children}</ol>
          {!disabled ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onAdd} icon={<Plus className="size-3.5" aria-hidden />}>
                Добавить: {(def.itemLabel ?? 'пункт').toLowerCase()}
              </Button>
              {nullable ? (
                <Button size="sm" variant="ghost" onClick={() => onToggleNull?.(false)} icon={<X className="size-3.5" aria-hidden />}>
                  Убрать блок
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}

export function TextListField({ def, value, onChange, error, disabled }: FieldProps<TextItem[] | null>) {
  const items = value ?? [];
  const label = def.itemLabel ?? 'Пункт';
  const set = (i: number, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, value: v } : it)));
  return (
    <ListShell
      def={def}
      error={error}
      disabled={disabled}
      count={items.length}
      nullable={def.kind === 'listNull'}
      isNull={value === null}
      onToggleNull={(on) => onChange(on ? [{ value: '', from: null }] : null)}
      onAdd={() => onChange([...items, { value: '', from: null }])}
    >
      {items.map((it, i) => (
        <li key={`${it.from ?? 'n'}-${i}`} className="flex items-start gap-2">
          <span className="mt-2 w-5 shrink-0 text-right text-xs text-ink-faint tabular-nums">{i + 1}.</span>
          <textarea
            aria-label={`${label} ${i + 1}`}
            value={it.value}
            disabled={disabled}
            rows={Math.min(4, Math.max(1, Math.ceil(it.value.length / 90)))}
            onChange={(e) => set(i, e.target.value)}
            className={cx(textarea, 'min-h-9', !it.value.trim() && error ? 'border-danger' : 'border-line-strong')}
          />
          <ItemTools index={i} count={items.length} disabled={disabled} label={label} onMove={(d) => onChange(move(items, i, d))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
        </li>
      ))}
    </ListShell>
  );
}

type Pair = LabelValueItem | TitleDescItem;

export function PairListField({ def, value, onChange, error, disabled }: FieldProps<Pair[] | null>) {
  const titleDesc = def.kind !== 'labelValue';
  const [a, b] = titleDesc ? (['title', 'description'] as const) : (['label', 'value'] as const);
  const [la, lb] = titleDesc ? ['Заголовок', 'Описание'] : ['Название', 'Значение'];
  const items = (value ?? []) as unknown as Array<Record<string, string | number | null>>;
  const label = def.itemLabel ?? 'Элемент';
  const blank = (): Pair => (titleDesc ? { title: '', description: '', from: null } : { label: '', value: '', from: null });
  const set = (i: number, k: string, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) as unknown as Pair[]);
  return (
    <ListShell
      def={def}
      error={error}
      disabled={disabled}
      count={items.length}
      nullable={def.kind === 'titleDescNull'}
      isNull={value === null}
      onToggleNull={(on) => onChange(on ? [blank()] : null)}
      onAdd={() => onChange([...(items as unknown as Pair[]), blank()])}
    >
      {items.map((it, i) => (
        <li key={`${it.from ?? 'n'}-${i}`} className="flex items-start gap-2 rounded-md border border-line bg-subtle/40 p-2.5">
          <span className="mt-2 w-5 shrink-0 text-right text-xs text-ink-faint tabular-nums">{i + 1}.</span>
          <div className={cx('grid min-w-0 flex-1 gap-2', titleDesc ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
            <Input aria-label={`${label} ${i + 1}: ${la.toLowerCase()}`} placeholder={la} value={String(it[a] ?? '')} disabled={disabled} onChange={(e) => set(i, a, e.target.value)} />
            {titleDesc ? (
              <textarea
                aria-label={`${label} ${i + 1}: ${lb.toLowerCase()}`}
                placeholder={lb}
                value={String(it[b] ?? '')}
                disabled={disabled}
                rows={3}
                onChange={(e) => set(i, b, e.target.value)}
                className={cx(textarea, 'border-line-strong')}
              />
            ) : (
              <Input aria-label={`${label} ${i + 1}: ${lb.toLowerCase()}`} placeholder={lb} value={String(it[b] ?? '')} disabled={disabled} onChange={(e) => set(i, b, e.target.value)} />
            )}
          </div>
          <ItemTools
            index={i}
            count={items.length}
            disabled={disabled}
            label={label}
            onMove={(d) => onChange(move(items, i, d) as unknown as Pair[])}
            onRemove={() => onChange(items.filter((_, j) => j !== i) as unknown as Pair[])}
          />
        </li>
      ))}
    </ListShell>
  );
}

export function PatentInfoField({ def, value, onChange, error, disabled }: FieldProps<PatentInfoForm | null>) {
  if (value === null)
    return (
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-ink">{def.label}</p>
        <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-ink-muted">
          Блок не показывается на сайте.
          {!disabled ? (
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange({ patentNumber: '', location: '', keyPoints: [] })}>
              Добавить блок
            </Button>
          ) : null}
        </div>
      </div>
    );
  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-[13px] font-medium text-ink">{def.label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField def={{ name: 'patentNumber', label: 'Номер патента (как на сайте)', kind: 'line', section: 'content', max: 300 }} value={value.patentNumber} disabled={disabled} onChange={(v) => onChange({ ...value, patentNumber: v })} />
        <TextField def={{ name: 'location', label: 'Место', kind: 'line', section: 'content', max: 300 }} value={value.location} disabled={disabled} onChange={(v) => onChange({ ...value, location: v })} />
      </div>
      <TextListField def={{ name: 'keyPoints', label: 'Ключевые пункты', kind: 'list', section: 'content', itemLabel: 'Пункт' }} value={value.keyPoints} disabled={disabled} onChange={(v) => onChange({ ...value, keyPoints: v ?? [] })} />
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      {!disabled ? (
        <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={() => onChange(null)}>
          Убрать блок
        </Button>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Media and relations
// ---------------------------------------------------------------------------

export function MediaField({ def, value, onChange, error, disabled }: FieldProps<string>) {
  const media = useMedia();
  const [open, setOpen] = useState(false);
  const item = media.data?.items.find((m) => m.id === value);
  const nullable = def.kind === 'mediaNull';
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium text-ink">{def.label}</p>
      <div className={cx('flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2', error ? 'border-danger' : 'border-line')}>
        <div className="min-w-0 flex-1">
          <MediaSummary item={item} />
        </div>
        {!disabled ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setOpen(true)} aria-label={`${def.label}: выбрать`}>
              {value ? 'Заменить' : 'Выбрать'}
            </Button>
            {nullable && value ? (
              <Button size="sm" variant="ghost" onClick={() => onChange('')}>
                Убрать
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {def.hint ? <p className="text-xs text-ink-muted">{def.hint}</p> : null}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      <MediaPicker open={open} onOpenChange={setOpen} kind={def.mediaKind ?? 'image'} onPick={onChange} />
    </div>
  );
}

export function MediaListField({ def, value, onChange, error, disabled }: FieldProps<string[]>) {
  const media = useMedia();
  const [open, setOpen] = useState(false);
  const list = value ?? [];
  return (
    <ListShell def={{ ...def, itemLabel: 'изображение' }} error={error} disabled={disabled} count={list.length} onAdd={() => setOpen(true)}>
      {list.map((id, i) => (
        <li key={id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
          <span className="w-5 shrink-0 text-right text-xs text-ink-faint tabular-nums">{i + 1}.</span>
          <div className="min-w-0 flex-1">
            <MediaSummary item={media.data?.items.find((m) => m.id === id)} empty="Файл не найден" />
          </div>
          <ItemTools index={i} count={list.length} disabled={disabled} label="Изображение" onMove={(d) => onChange(move(list, i, d))} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
        </li>
      ))}
      <MediaPicker open={open} onOpenChange={setOpen} kind="image" exclude={list} onPick={(id) => onChange([...list, id])} />
    </ListShell>
  );
}

/** Options for a relation: records of the target collection (title, status). */
export function useRefOptions(ref: 'technologies' | 'projects' | undefined) {
  return useQuery({
    queryKey: ['content', ref, 'options'],
    queryFn: () => api(`GET /api/v1/content/${ref!}` as 'GET /api/v1/content/projects', { query: { limit: 100, sort: 'title' } }),
    enabled: !!ref,
    staleTime: 60_000,
  });
}

export function RefField({ def, value, onChange, error, disabled }: FieldProps<string>) {
  const opts = useRefOptions(def.ref);
  const items = opts.data?.items ?? [];
  return (
    <Labeled def={def} error={error}>
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} invalid={invalid} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            {opts.isPending ? 'Загрузка…' : 'Выберите…'}
          </option>
          {items
            .filter((o) => o.status !== 'archived' || o.id === value)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.status === 'draft' ? ' (черновик)' : o.status === 'archived' ? ' (в архиве)' : ''}
              </option>
            ))}
        </Select>
      )}
    </Labeled>
  );
}

export function RefListField({ def, value, onChange, error, disabled }: FieldProps<string[]>) {
  const opts = useRefOptions(def.ref);
  const list = value ?? [];
  const items = opts.data?.items ?? [];
  const [adding, setAdding] = useState('');
  const titleOf = (id: string) => items.find((o) => o.id === id)?.title ?? 'Запись не найдена';
  const addId = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-medium text-ink">
        {def.label} <span className="font-normal text-ink-muted">· {list.length}</span>
      </legend>
      <ol className="space-y-1.5">
        {list.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px]">
            <span className="w-5 shrink-0 text-right text-xs text-ink-faint tabular-nums">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{titleOf(id)}</span>
            <ItemTools index={i} count={list.length} disabled={disabled} label="Связь" onMove={(d) => onChange(move(list, i, d))} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ol>
      {!disabled ? (
        <div className="flex max-w-md items-center gap-2">
          <label htmlFor={addId} className="sr-only">
            Добавить связь
          </label>
          <Select id={addId} value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Добавить…</option>
            {items
              .filter((o) => !list.includes(o.id) && o.status !== 'archived')
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
          </Select>
          <Button
            size="md"
            disabled={!adding}
            onClick={() => {
              onChange([...list, adding]);
              setAdding('');
            }}
          >
            Добавить
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}
