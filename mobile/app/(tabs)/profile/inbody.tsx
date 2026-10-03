import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  deleteInBodyMeasurement,
  FIELD_DEFS,
  getInBodyImageSource,
  listInBodyMeasurements,
  updateInBodyMeasurement,
  uploadInBodyImage,
  type InBodyImageSource,
  type InBodyMeasurement,
  type NumericField,
} from '@/src/api/inbody';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { TextField } from '@/src/components/ui/TextField';
import { LineChart } from '@/src/components/charts/LineChart';
import { colors, fontFamily, radii } from '@/src/theme/tokens';

/**
 * Phase 21 — mirrors the root app's profile/inbody/inbody-manager.tsx
 * (upload -> current values -> trends -> history), with camera/library
 * capture replacing the web `<input type="file">` and the four cross-
 * platform wrinkles the web version never has to deal with: (1) the
 * multipart upload's file part is platform-specific — see
 * api/inbody.ts's uploadInBodyImage; (2) viewing the stored photo needs an
 * auth header a plain <Image> never sends — see getInBodyImageSource; (3)
 * there's no native equivalent of a `<details>` fallback, so the raw-OCR
 * fallback is a plain expand/collapse Pressable instead; (4) no delete
 * confirmation dialog, same as every other mobile CRUD screen on this app
 * (challenges/supplements/goals delete immediately) — the web version's
 * window.confirm has no mobile equivalent without introducing a new dialog
 * pattern this app doesn't otherwise use.
 */

const METRIC_COLOR = colors.primary.default;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatValue(value: number | null, unit?: string): string {
  if (value === null) return '—';
  return unit ? `${value}${unit}` : `${value}`;
}

function CurrentValueCard({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <Card style={styles.valueCard}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueNumber}>
        {value === null ? '—' : value}
        {value !== null && unit ? <Text style={styles.valueUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.valueStatus}>{value === null ? 'Not recorded' : ' '}</Text>
    </Card>
  );
}

function TrendChartCard({
  title,
  measurements,
  dataKey,
}: {
  title: string;
  measurements: InBodyMeasurement[];
  dataKey: NumericField;
}) {
  const sorted = [...measurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const labels = sorted.map((m) => formatDateLabel(m.measuredAt));
  const values = sorted.map((m) => m[dataKey]);
  const hasData = values.some((v) => v !== null);

  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      {hasData ? (
        <View style={styles.chartBody}>
          <LineChart labels={labels} series={[{ key: dataKey, name: title, color: METRIC_COLOR, values }]} />
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>Not enough data yet.</Text>
        </View>
      )}
    </Card>
  );
}

function EditForm({
  measurement,
  onCancel,
  onSaved,
}: {
  measurement: InBodyMeasurement;
  onCancel: () => void;
  onSaved: (updated: InBodyMeasurement) => void;
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

  async function handleSave() {
    setSubmitting(true);
    setError(null);

    // Empty means "clear this field back to not recorded" (null); anything
    // else is sent as-is, letting the server's UpdateInBodyMeasurementSchema
    // be the final range check — same approach as the web EditForm.
    const patch: Partial<Record<NumericField, number | null>> & { measuredAt?: string } = {};
    for (const field of FIELD_DEFS) {
      const raw = values[field.key].trim();
      patch[field.key] = raw === '' ? null : Number(raw);
    }
    const parsedDate = new Date(measuredAt);
    if (measuredAt && !Number.isNaN(parsedDate.getTime())) {
      patch.measuredAt = parsedDate.toISOString();
    }

    try {
      const updated = await updateInBodyMeasurement(measurement.id, patch);
      onSaved(updated);
    } catch {
      setError('Could not save. Please check the values and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.formCard}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <TextField
        label="Measured at (yyyy-mm-ddThh:mm)"
        value={measuredAt}
        onChangeText={setMeasuredAt}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.fieldGrid}>
        {FIELD_DEFS.map((field) => (
          <TextField
            key={field.key}
            label={field.unit ? `${field.label} (${field.unit})` : field.label}
            keyboardType="numeric"
            placeholder="—"
            value={values[field.key]}
            onChangeText={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
            style={styles.fieldGridItem}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button title={submitting ? 'Saving…' : 'Save'} size="sm" onPress={handleSave} loading={submitting} style={styles.flex1} />
        <Button title="Cancel" size="sm" variant="outline" onPress={onCancel} style={styles.flex1} />
      </View>
    </Card>
  );
}

function MeasurementRow({
  measurement,
  onUpdated,
  onDeleted,
}: {
  measurement: InBodyMeasurement;
  onUpdated: (m: InBodyMeasurement) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [showingPhoto, setShowingPhoto] = useState(false);
  const [photoSource, setPhotoSource] = useState<InBodyImageSource | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    if (!showingPhoto) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setPhotoLoading(true);
    setPhotoError(false);
    getInBodyImageSource(measurement.id)
      .then((source) => {
        if (cancelled) return;
        if (Platform.OS === 'web') objectUrl = source.uri;
        setPhotoSource(source);
      })
      .catch(() => {
        if (!cancelled) setPhotoError(true);
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPhotoSource(null);
    };
  }, [showingPhoto, measurement.id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteInBodyMeasurement(measurement.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <EditForm
        measurement={measurement}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
      />
    );
  }

  const missingFields = FIELD_DEFS.filter((f) => measurement[f.key] === null);

  return (
    <Card>
      <Text style={styles.rowTitle}>{formatDateTime(measurement.measuredAt)}</Text>
      <Text style={styles.rowSubtitle}>
        {FIELD_DEFS.slice(0, 5)
          .map((f) => `${f.label}: ${formatValue(measurement[f.key], f.unit)}`)
          .join(' · ')}
      </Text>

      {missingFields.length > 0 ? (
        <Text style={styles.rowNotice}>Not recorded: {missingFields.map((f) => f.label).join(', ')}</Text>
      ) : null}

      {missingFields.length > 0 && measurement.rawOcrText ? (
        <View style={styles.rawTextSection}>
          <Pressable onPress={() => setShowRawText((v) => !v)}>
            <Text style={styles.linkText}>
              {showRawText ? 'Hide raw scanned text' : 'Show raw scanned text (to fill in the missing fields by hand)'}
            </Text>
          </Pressable>
          {showRawText ? (
            <View style={styles.rawTextBox}>
              <Text style={styles.rawTextContent}>{measurement.rawOcrText}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showingPhoto ? (
        <View style={styles.photoBox}>
          {photoLoading ? (
            <ActivityIndicator color={colors.primary.default} />
          ) : photoError ? (
            <Text style={styles.rowNotice}>Could not load the photo.</Text>
          ) : photoSource ? (
            <Image source={photoSource} style={styles.photo} resizeMode="contain" alt="InBody scan photo" />
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionsStack}>
        <View style={styles.row}>
          <Button
            title={showingPhoto ? 'Hide photo' : 'View photo'}
            size="sm"
            variant="outline"
            onPress={() => setShowingPhoto((v) => !v)}
            style={styles.flex1}
          />
          <Button title="Edit" size="sm" variant="outline" onPress={() => setEditing(true)} style={styles.flex1} />
        </View>
        <Button title={deleting ? 'Deleting…' : 'Delete'} size="sm" variant="destructive" onPress={handleDelete} loading={deleting} />
      </View>
    </Card>
  );
}

function UploadSection({ onUploaded }: { onUploaded: (m: InBodyMeasurement) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handlePicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const created = await uploadInBodyImage(result.assets[0]);
      onUploaded(created);
      const missing = FIELD_DEFS.filter((f) => created[f.key] === null);
      setNotice(
        missing.length === 0
          ? 'Scan uploaded — all fields were read successfully.'
          : `Scan uploaded. Could not reliably read: ${missing.map((f) => f.label).join(', ')}. Use Edit on the new entry to fill those in.`,
      );
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'AbortError'
          ? 'This is taking far longer than expected and was stopped. Please try again — if it keeps happening, try a smaller or clearer photo.'
          : 'Could not process that image. Please try a clearer photo of the report.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to take a photo of the report.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    await handlePicked(result);
  }

  async function handleChooseFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to choose a photo of the report.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    await handlePicked(result);
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Upload a scan</Text>
      <Text style={styles.cardDescription}>
        A photo of a printed InBody report. Text and values are read automatically and saved right
        away — anything that couldn&apos;t be read reliably is left blank for you to fill in.
      </Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      <View style={styles.row}>
        <Button title="Take photo" size="sm" onPress={handleTakePhoto} disabled={uploading} style={styles.flex1} />
        <Button
          title="Choose from library"
          size="sm"
          variant="outline"
          onPress={handleChooseFromLibrary}
          disabled={uploading}
          style={styles.flex1}
        />
      </View>
      {uploading ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator color={colors.primary.default} />
          <Text style={styles.uploadingText}>
            Reading the report… this usually takes 15-20 seconds, but can take up to a minute.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function InBodyScreen() {
  const [measurements, setMeasurements] = useState<InBodyMeasurement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listInBodyMeasurements()
      .then((list) => setMeasurements([...list].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))))
      .catch(() => setError('Could not load your InBody scans.'));
  }, []);

  function handleUploaded(created: InBodyMeasurement) {
    setMeasurements((prev) => [created, ...(prev ?? [])].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)));
  }

  if (!measurements) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{error}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  const latest = measurements[0] ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <UploadSection onUploaded={handleUploaded} />

      <View>
        <Text style={styles.sectionTitle}>Current values</Text>
        {latest ? (
          <>
            <Text style={styles.sectionSubtitle}>From the scan on {formatDateTime(latest.measuredAt)}.</Text>
            <View style={styles.valuesGrid}>
              {FIELD_DEFS.map((field) => (
                <CurrentValueCard key={field.key} label={field.label} value={latest[field.key]} unit={field.unit} />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.empty}>No scans uploaded yet.</Text>
        )}
      </View>

      {measurements.length > 1 ? (
        <View>
          <Text style={styles.sectionTitle}>Trends</Text>
          <View style={styles.chartsStack}>
            <TrendChartCard title="Weight" measurements={measurements} dataKey="weightKg" />
            <TrendChartCard title="Body Fat %" measurements={measurements} dataKey="bodyFatPercentage" />
            <TrendChartCard title="Skeletal Muscle Mass" measurements={measurements} dataKey="skeletalMuscleMassKg" />
            <TrendChartCard title="InBody Score" measurements={measurements} dataKey="inBodyScore" />
          </View>
        </View>
      ) : null}

      <View>
        <Text style={styles.sectionTitle}>History</Text>
        {measurements.length === 0 ? (
          <Text style={styles.empty}>No scans yet.</Text>
        ) : (
          <View style={styles.historyStack}>
            {measurements.map((m) => (
              <MeasurementRow
                key={m.id}
                measurement={m}
                onUpdated={(updated) =>
                  setMeasurements((prev) =>
                    (prev ?? [])
                      .map((x) => (x.id === updated.id ? updated : x))
                      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
                  )
                }
                onDeleted={() => setMeasurements((prev) => (prev ?? []).filter((x) => x.id !== m.id))}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    gap: 12,
  },
  cardTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 17,
    color: colors.foreground,
  },
  cardDescription: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
    marginTop: -6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadingText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  sectionTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 18,
    color: colors.primary.default,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
    marginBottom: 10,
  },
  empty: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  valueCard: {
    width: '47%',
  },
  valueLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  valueNumber: {
    marginTop: 4,
    fontFamily: fontFamily.sansSemibold,
    fontSize: 22,
    color: colors.foreground,
  },
  valueUnit: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  valueStatus: {
    marginTop: 2,
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  chartsStack: {
    gap: 12,
  },
  chartTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  chartBody: {
    marginTop: 10,
  },
  emptyChart: {
    marginTop: 10,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  historyStack: {
    gap: 12,
  },
  formCard: {
    gap: 12,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldGridItem: {
    width: '47%',
  },
  rowTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  rowSubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  rowNotice: {
    marginTop: 6,
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  rawTextSection: {
    marginTop: 6,
  },
  linkText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
    color: colors.primary.default,
  },
  rawTextBox: {
    marginTop: 6,
    maxHeight: 160,
    borderRadius: radii.xl,
    backgroundColor: colors.muted.default,
    padding: 10,
  },
  rawTextContent: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  photoBox: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    borderRadius: radii.xl,
    backgroundColor: colors.muted.default,
    padding: 8,
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: radii.xl,
  },
  actionsStack: {
    marginTop: 10,
    gap: 8,
  },
});
