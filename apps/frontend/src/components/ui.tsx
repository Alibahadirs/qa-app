import type { ReactNode } from 'react';
import { PRIORITY_LABELS, type Priority } from '../api/types.js';

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
  MEDIUM: 'bg-sky-50 text-sky-700 ring-sky-200',
  HIGH: 'bg-amber-50 text-amber-800 ring-amber-200',
  CRITICAL: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none';

export const buttonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

export const primaryButton = `${buttonClass} bg-slate-900 text-white hover:bg-slate-700`;
export const secondaryButton = `${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const dangerButton = `${buttonClass} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`;

const ALERT_STYLES = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
} as const;

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: keyof typeof ALERT_STYLES;
  children: ReactNode;
}) {
  return (
    <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${ALERT_STYLES[kind]}`}>
      {kind === 'warning' && <span aria-hidden className="mr-1.5">⚠</span>}
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function Spinner({ label = 'Yükleniyor…' }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{label}</p>;
}
