'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface InBodyMeasurementDTO {
  id: string;
  measuredAt: string;
  weightKg: number | null;
  bodyFatPercentage: number | null;
  skeletalMuscleMassKg: number | null;
  fatFreeMassKg: number | null;
  bmi: number | null;
  inBodyScore: number | null;
  visceralFatLevel: number | null;
  basalMetabolicRateKcal: number | null;
  totalBodyWaterL: number | null;
  ecwRatio: number | null;
  rawOcrText: string | null;
  createdAt: string;
}

type NumericField =
  | 'weightKg'
  | 'bodyFatPercentage'
  | 'skeletalMuscleMassKg'
  | 'fatFreeMassKg'
  | 'bmi'
  | 'inBodyScore'
  | 'visceralFatLevel'
  | 'basalMetabolicRateKcal'
  | 'totalBodyWaterL'
  | 'ecwRatio';

/**
 * One source of truth for every metric this page shows/edits, so the
 * current-value cards, the edit form, and the trend charts can't drift out
 * of sync with each other or with the ranges enforced server-side in
 * src/lib/validation/inbody.schemas.ts.
 */
const FIELD_DEFS: {
  key: NumericField;
  label: string;
  unit?: string;
  step: string;
  integer?: boolean;
}[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'bodyFatPercentage', label: 'Body Fat', unit: '%', step: '0.1' },
  { key: 'skeletalMuscleMassKg', label: 'Skeletal Muscle Mass', unit: 'kg', step: '0.1' },
  { key: 'fatFreeMassKg', label: 'Fat-Free Mass', unit: 'kg', step: '0.1' },
  { key: 'bmi', label: 'BMI', step: '0.1' },
  { key: 'inBodyScore', label: 'InBody Score', step: '1', integer: true },
  { key: 'visceralFatLevel', label: 'Visceral Fat Level', step: '1', integer: true },
  { key: 'basalMetabolicRateKcal', label: 'BMR', unit: 'kcal', step: '1', integer: true },
  { key: 'totalBodyWaterL', label: 'Total Body Water', unit: 'L', step: '0.1' },
  { key: 'ecwRatio', label: 'ECW Ratio', step: '0.001' },
];

// Trend-chart color, matching trend-charts.tsx's METRIC_COLOR: the app's
// primary forest green, used for every single-series chart on this page
// (each card title already names its series, so no legend is needed —
// see the dataviz skill's color-formula guidance on single-series charts).
const METRIC_COLOR = '#2F4A38';

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatValue(value: number | null, unit?: string): string {
  if (value === null) return '—';
  return unit ? `${value}${unit}` : `${value}`;
}

function CurrentValueCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          {value === null ? '—' : value}
          {value !== null && unit ? (
            <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {value === null ? 'Not recorded' : ' '}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  measurements,
  dataKey,
}: {
  title: string;
  measurements: InBodyMeasurementDTO[];
  dataKey: NumericField;
}) {
  const chartData = useMemo(
    () =>
      measurements
        .slice()
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
        .map((m) => ({ label: formatDateLabel(m.measuredAt), value: m[dataKey] })),
    [measurements, dataKey],
  );
  const hasData = chartData.some((p) => p.value !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke={METRIC_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Not enough data yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditForm({
  measurement,
  onCancel,
  onSaved,
}: {
  measurement: InBodyMeasurementDTO;
  onCancel: () => void;
  onSaved: (updated: InBodyMeasurementDTO) => void;
}) {
  const [values, setValues] = useState<Record<NumericField, string>>(() => {
    const initial = {} as Record<NumericField, string>;
    for (const field of FIELD_DEFS) {
      const v = measurement[field.key];
      initial[field.key] = v === null ? '' : String(v);
    }
    return initial;
  });
  const [measuredAt, setMeasuredAt] = useState(measurement.measuredAt.slice(0, 16));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Empty string means "clear this field back to not recorded" (null);
    // anything else is parsed as a number and sent as-is, letting the
    // server's UpdateInBodyMeasurementSchema be the final range check.
    const patch: Record<string, number | null | string> = {};
    for (const field of FIELD_DEFS) {
      const raw = values[field.key].trim();
      patch[field.key] = raw === '' ? null : Number(raw);
    }
    if (measuredAt) {
      patch.measuredAt = new Date(measuredAt).toISOString();
    }

    try {
      const response = await fetch(`/api/inbody/${measurement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error('save failed');
      const updated: InBodyMeasurementDTO = await response.json();
      onSaved(updated);
    } catch {
      setError('Could not save. Please check the values and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="space-y-1">
        <Label htmlFor={`measuredAt-${measurement.id}`}>Measured at</Label>
        <Input
          id={`measuredAt-${measurement.id}`}
          type="datetime-local"
          value={measuredAt}
          onChange={(e) => setMeasuredAt(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELD_DEFS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`${field.key}-${measurement.id}`}>
              {field.label}
              {field.unit ? ` (${field.unit})` : ''}
            </Label>
            <Input
              id={`${field.key}-${measurement.id}`}
              type="number"
              step={field.step}
              placeholder="—"
              value={values[field.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MeasurementRow({
  measurement,
  onUpdated,
  onDeleted,
}: {
  measurement: InBodyMeasurementDTO;
  onUpdated: (m: InBodyMeasurementDTO) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm('Delete this scan and its photo? This cannot be undone.')) return;
    setDeleting(true);
    const response = await fetch(`/api/inbody/${measurement.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (response.ok || response.status === 204) {
      onDeleted();
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-4">
          <EditForm
            measurement={measurement}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              onUpdated(updated);
              setEditing(false);
            }}
          />
        </CardContent>
      </Card>
    );
  }

  const missingFields = FIELD_DEFS.filter((f) => measurement[f.key] === null);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium">{formatDateTime(measurement.measuredAt)}</p>
          <p className="text-sm text-muted-foreground">
            {FIELD_DEFS.slice(0, 5)
              .map((f) => `${f.label}: ${formatValue(measurement[f.key], f.unit)}`)
              .join(' · ')}
          </p>
          {missingFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not recorded: {missingFields.map((f) => f.label).join(', ')}
            </p>
          )}
          {missingFields.length > 0 && measurement.rawOcrText && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">
                Show raw scanned text (to fill in the missing fields by hand)
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2">
                {measurement.rawOcrText}
              </pre>
            </details>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={`/api/inbody/${measurement.id}/image`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-xl border border-primary/30 px-3 text-sm font-medium text-primary hover:bg-primary/5"
          >
            View photo
          </a>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadForm({ onUploaded }: { onUploaded: (m: InBodyMeasurementDTO) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);

    const formData = new FormData();
    formData.set('image', file);

    // The server gives OCR up to 90s before it gives up and returns an
    // error (see inbody-ocr.service.ts's OCR_TIMEOUT_MS) rather than
    // hanging forever on a stuck native call. This client-side abort is a
    // second line of defense at a slightly longer bound, so a request that
    // never gets a response at all -- a dropped connection, a proxy that
    // swallows it silently -- still turns into a visible error instead of
    // an upload button that spins forever with nothing ever saved.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 100_000);

    try {
      const response = await fetch('/api/inbody', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'upload failed');
      }
      const created: InBodyMeasurementDTO = await response.json();
      onUploaded(created);
      const missing = FIELD_DEFS.filter((f) => created[f.key] === null);
      setNotice(
        missing.length === 0
          ? 'Scan uploaded — all fields were read successfully.'
          : `Scan uploaded. Could not reliably read: ${missing
              .map((f) => f.label)
              .join(', ')}. Use Edit on the new entry to fill those in.`,
      );
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'This is taking far longer than expected and was stopped. Please try again — if it keeps happening, try a smaller or clearer photo.'
          : 'Could not process that image. Please try a clearer photo of the report.',
      );
    } finally {
      clearTimeout(abortTimer);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a scan</CardTitle>
        <CardDescription>
          A photo or scan of a printed InBody report. Text and values are read automatically and
          saved right away — anything that couldn&apos;t be read reliably is left blank for you to
          fill in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="destructive">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}
        <Input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={handleFileChange}
        />
        {uploading && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Reading the report… this usually takes 15-20 seconds, but can take up to a minute.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function InBodyManager({ initial }: { initial: InBodyMeasurementDTO[] }) {
  const [measurements, setMeasurements] = useState<InBodyMeasurementDTO[]>(
    [...initial].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
  );

  const latest = measurements[0] ?? null;

  return (
    <div className="space-y-6">
      <UploadForm
        onUploaded={(created) =>
          setMeasurements((prev) =>
            [created, ...prev].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
          )
        }
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-primary">Current values</h2>
        {latest ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              From the scan on {formatDateTime(latest.measuredAt)}.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {FIELD_DEFS.map((field) => (
                <CurrentValueCard
                  key={field.key}
                  label={field.label}
                  value={latest[field.key]}
                  unit={field.unit}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No scans uploaded yet.</p>
        )}
      </div>

      {measurements.length > 1 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-primary">Trends</h2>
          <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2')}>
            <ChartCard title="Weight" measurements={measurements} dataKey="weightKg" />
            <ChartCard title="Body Fat %" measurements={measurements} dataKey="bodyFatPercentage" />
            <ChartCard title="Skeletal Muscle Mass" measurements={measurements} dataKey="skeletalMuscleMassKg" />
            <ChartCard title="InBody Score" measurements={measurements} dataKey="inBodyScore" />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-primary">History</h2>
        {measurements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scans yet.</p>
        ) : (
          <div className="space-y-3">
            {measurements.map((m) => (
              <MeasurementRow
                key={m.id}
                measurement={m}
                onUpdated={(updated) =>
                  setMeasurements((prev) =>
                    prev
                      .map((x) => (x.id === updated.id ? updated : x))
                      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
                  )
                }
                onDeleted={() =>
                  setMeasurements((prev) => prev.filter((x) => x.id !== m.id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
