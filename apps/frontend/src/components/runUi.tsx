import {
  RESULT_LABELS,
  RUN_STATUS_LABELS,
  type ResultCounts,
  type ResultStatus,
  type RunStatus,
} from '../api/types.js';

export const RESULT_STYLES: Record<ResultStatus, { badge: string; bar: string; dot: string }> = {
  PASS: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  FAIL: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  BLOCKED: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  SKIPPED: {
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    bar: 'bg-slate-400',
    dot: 'bg-slate-400',
  },
  NOT_RUN: {
    badge: 'bg-white text-slate-500 ring-slate-300',
    bar: 'bg-slate-200',
    dot: 'bg-slate-300',
  },
};

const RUN_STATUS_STYLES: Record<RunStatus, string> = {
  IN_PROGRESS: 'bg-sky-50 text-sky-700 ring-sky-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ABORTED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function ResultBadge({ status }: { status: ResultStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${RESULT_STYLES[status].badge}`}
    >
      {RESULT_LABELS[status]}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${RUN_STATUS_STYLES[status]}`}
    >
      {RUN_STATUS_LABELS[status]}
    </span>
  );
}

const BAR_ORDER: ResultStatus[] = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'];

export function ProgressBar({ counts, total }: { counts: ResultCounts; total: number }) {
  if (total === 0) return null;
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label={BAR_ORDER.map((s) => `${RESULT_LABELS[s]} ${counts[s]}`).join(', ')}
    >
      {BAR_ORDER.map((s) =>
        counts[s] > 0 ? (
          <div
            key={s}
            className={RESULT_STYLES[s].bar}
            style={{ width: `${(counts[s] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function CountsLine({ counts, total }: { counts: ResultCounts; total: number }) {
  const done = total - counts.NOT_RUN;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      <span className="font-medium text-slate-700">
        {done}/{total} işaretlendi
      </span>
      {BAR_ORDER.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={`size-2 rounded-full ${RESULT_STYLES[s].dot}`} />
          {RESULT_LABELS[s]} {counts[s]}
        </span>
      ))}
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins === 0) return `${secs} sn`;
  const hours = Math.floor(mins / 60);
  if (hours === 0) return `${mins} dk ${secs} sn`;
  return `${hours} sa ${mins % 60} dk`;
}
