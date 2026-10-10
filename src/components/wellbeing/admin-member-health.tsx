'use client';

import Link from 'next/link';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getGroupMemberHealth } from '@/lib/wellbeing/groups-api';
import { displayName, formatDay, minutesToHoursLabel, providerLabel, timeAgo } from '@/lib/wellbeing/format';
import { LoadingLine, PageTitle } from './parts';
import { useLoad } from './use-load';

const SLEEP_COLOR = '#2a78d6';
const READINESS_COLOR = '#eb6834';
const ACTIVITY_COLOR = '#1baf7a';
const METRIC_COLOR = '#2F4A38';

const CONNECTION_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
};

function Stat({ label, value, unit }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold">
        {value === null ? '—' : value}
        {value !== null && unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

/**
 * Corporate wellbeing — admin: one member's health data. Only people who
 * joined this group (and consented) can be opened; every open is audited
 * server-side.
 */
export function AdminMemberHealth({ groupId, userId }: { groupId: string; userId: string }) {
  const { data, error } = useLoad(() => getGroupMemberHealth(groupId, userId), [groupId, userId]);

  if (error) {
    return <Alert variant="destructive">Could not load this member&rsquo;s data. They may have left the group.</Alert>;
  }
  if (!data) return <LoadingLine />;

  const { snapshot, trend } = data;
  const points = trend.map((p) => ({ ...p, label: formatDay(p.date).replace(/ \d{4}$/, '') }));
  const hasTrend = trend.some((p) => p.sleepScore !== null || p.steps !== null || p.readinessScore !== null || p.activityScore !== null);

  return (
    <div className="space-y-6">
      <Link href={`/admin/groups/${groupId}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to the group
      </Link>
      <div>
        <PageTitle>{displayName(data.member)}</PageTitle>
        {data.member.fullName && <p className="mt-2 text-sm text-muted-foreground">{data.member.email}</p>}
        <p className="text-sm text-muted-foreground">In the group since {formatDay(data.member.joinedAt.slice(0, 10))}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.connections.length === 0 && <p className="text-muted-foreground">No device connected.</p>}
          {data.connections.map((connection) => (
            <p key={connection.provider}>
              {providerLabel(connection.provider)} · {CONNECTION_LABEL[connection.status] ?? connection.status} ·{' '}
              {connection.lastSyncAt ? `last sync ${timeAgo(connection.lastSyncAt)}` : 'never synced'}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{snapshot?.isToday ? 'Today' : 'Most recent day'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot ? (
            <>
              <p className="text-xs text-muted-foreground">
                {formatDay(snapshot.date)}
                {snapshot.sourceProviders.length ? ` · ${snapshot.sourceProviders.map(providerLabel).join(', ')}` : ''}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Sleep score" value={snapshot.sleepScore} />
                <Stat label="Readiness" value={snapshot.readinessScore} />
                <Stat label="Activity" value={snapshot.activityScore} />
                <Stat label="Sleep" value={snapshot.totalSleepMinutes === null ? null : minutesToHoursLabel(snapshot.totalSleepMinutes)} />
                <Stat label="Resting HR" value={snapshot.restingHeartRate} unit="bpm" />
                <Stat label="HRV" value={snapshot.averageHrv} unit="ms" />
                <Stat label="Steps" value={snapshot.steps} />
                <Stat label="Active kcal" value={snapshot.activeCalories} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No health data recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {hasTrend && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scores — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E1D3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sleepScore" name="Sleep" stroke={SLEEP_COLOR} strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="readinessScore" name="Readiness" stroke={READINESS_COLOR} strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="activityScore" name="Activity" stroke={ACTIVITY_COLOR} strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Steps — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E1D3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} width={44} />
                    <Tooltip />
                    <Line type="monotone" dataKey="steps" name="Steps" stroke={METRIC_COLOR} strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {data.weeklyWorkouts} in the last 7 days{' '}
            <span className="text-xs text-muted-foreground">(sessions of at least 10 minutes; auto-detected walks are not counted)</span>
          </p>
          {data.recentWorkouts.length === 0 && <p className="text-muted-foreground">No workouts in the last 14 days.</p>}
          {data.recentWorkouts.map((workout, index) => (
            <div key={`${workout.startedAt}-${index}`} className="flex items-center justify-between gap-3 border-t border-card-border pt-2">
              <span>
                {workout.activityType.replace(/_/g, ' ')} · {workout.durationMin} min
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(workout.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {providerLabel(workout.provider)}
                {workout.source ? ` (${workout.source})` : ''}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
