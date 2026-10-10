/* eslint-disable @next/next/no-img-element -- logos are served by our own API with fixed small size */
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { groupLogoUri, type GroupChallengeStatus, type MemberProgress } from '@/lib/wellbeing/groups-api';
import { STATUS_LABEL } from '@/lib/wellbeing/format';

/** A group's logo, or a neutral placeholder when it has none. `src` overrides (a just-picked local preview). */
export function GroupLogo({ logoUrl, src, size = 48 }: { logoUrl?: string | null; src?: string | null; size?: number }) {
  const source = src ?? groupLogoUri(logoUrl ?? null);
  if (source) {
    return (
      <img
        src={source}
        alt="Group logo"
        width={size}
        height={size}
        className="shrink-0 rounded-xl bg-muted object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Users style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

export function ProgressBar({ percent, completed }: { percent: number; completed?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div className={cn('h-2 rounded-full', completed ? 'bg-success' : 'bg-accent')} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function StatusBadge({ status }: { status: GroupChallengeStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** "3 of 5 · 60%" with a bar — one person's progress. */
export function ProgressLine({ progress, label }: { progress: MemberProgress; label?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-sm">
        {label ? <span className="font-medium">{label}</span> : <span />}
        <span className="text-muted-foreground">
          {progress.currentCount} of {progress.requiredCount}
          {progress.completed ? ' · goal reached' : ` · ${progress.percent}%`}
        </span>
      </div>
      <ProgressBar percent={progress.percent} completed={progress.completed} />
    </div>
  );
}

export function LoadingLine({ text = 'Loading…' }: { text?: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/** Large, stable page heading shared by the wellbeing pages (same gradient style as the other pages). */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="relative inline-block bg-gradient-to-r from-primary to-accent bg-clip-text font-display text-3xl font-semibold tracking-tight text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">
      {children}
    </h1>
  );
}
