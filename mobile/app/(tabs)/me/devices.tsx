import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import {
  disconnectOura,
  getConnections,
  getOuraAuthorizationUrl,
  syncOura,
  type ConnectionSummary,
  type OuraSyncResult,
} from '@/src/api/wearables';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import appleHealthNative from '@/src/health/native';
import { AppleHealthRateLimitedError } from '@/src/api/appleHealth';
import { HealthConnectRateLimitedError } from '@/src/api/healthConnect';
import { registerHealthConnectBackgroundSync } from '@/src/health/healthConnectBackground';
import healthConnectNative from '@/src/health/healthConnectNative';
import { syncHealthConnect } from '@/src/health/healthConnectSync';
import type { HealthConnectAvailability } from '@/src/health/healthConnectTypes';
import { syncAppleHealth } from '@/src/health/sync';
import { locale, useT, type TextKey } from '@/src/i18n';
import { colors, fontFamily, radii, screenBackground } from '@/src/theme/tokens';

/**
 * Real Oura connect/sync/disconnect, phase 19 — replaces the ScreenStub.
 * Mirrors the web app's profile/devices/page.tsx + sync-now-button.tsx, with
 * one structural difference: the mobile app has no server-rendered page to
 * redirect back to and no <form method="POST"> to submit, so connect and
 * disconnect go through the Bearer-JSON branch those two routes grew in
 * phase 19 (see src/api/wearables.ts) and the authorization URL is opened
 * here with expo-web-browser instead of a plain <a href>.
 *
 * Apple Health has no cloud API for us to connect — the phone itself reads
 * HealthKit (src/health/*, iOS native build only) and pushes daily summaries to
 * /api/integrations/apple-health/ingest. The card below connects/syncs it on
 * an iPhone and explains where it works on web/Android.
 *
 * Health Connect (Android) works the same way: the phone reads it and pushes
 * daily summaries to /api/integrations/health-connect/ingest. The card connects
 * and syncs it on an Android phone; on the web (and iPhone) it shows the
 * connection the Android app made — when it connected and when it last synced.
 */

const STATUS_LABEL_KEY: Record<string, TextKey> = {
  CONNECTED: 'devices.status.connected',
  DISCONNECTED: 'devices.status.disconnected',
  AUTH_REQUIRED: 'devices.status.authRequired',
  ERROR: 'devices.status.error',
};

const STATUS_BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  CONNECTED: { backgroundColor: '#E8F5EE', color: colors.success },
  DISCONNECTED: { backgroundColor: colors.muted.default, color: colors.muted.foreground },
  AUTH_REQUIRED: { backgroundColor: '#FBF2E3', color: colors.warning },
  ERROR: { backgroundColor: '#FBEAE9', color: colors.danger },
};

const SYNC_MESSAGE_KEY: Record<OuraSyncResult, TextKey> = {
  queued: 'devices.oura.sync.queued',
  rate_limited: 'devices.oura.sync.rateLimited',
  not_connected: 'devices.oura.sync.notConnected',
  error: 'devices.oura.sync.error',
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const labelKey = STATUS_LABEL_KEY[status];
  const style = STATUS_BADGE_STYLE[status] ?? STATUS_BADGE_STYLE.DISCONNECTED;
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: style.color }]}>{labelKey ? t(labelKey) : status}</Text>
    </View>
  );
}

export default function DevicesScreen() {
  const { t } = useT();
  const [connection, setConnection] = useState<ConnectionSummary | null>(null);
  const [appleConnection, setAppleConnection] = useState<ConnectionSummary | null>(null);
  const [appleSupported, setAppleSupported] = useState<boolean | null>(null);
  const [appleSyncing, setAppleSyncing] = useState(false);
  const [appleMessage, setAppleMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [hcConnection, setHcConnection] = useState<ConnectionSummary | null>(null);
  // Only an Android phone can ever have Health Connect, so everywhere else the answer is known up front.
  const [hcAvailability, setHcAvailability] = useState<HealthConnectAvailability | null>(
    Platform.OS === 'android' ? null : 'unsupported',
  );
  const [hcBackground, setHcBackground] = useState(false);
  const [hcSyncing, setHcSyncing] = useState(false);
  const [hcMessage, setHcMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState(false);
  const [syncStatus, setSyncStatus] = useState<OuraSyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const connections = await getConnections();
      setConnection(connections.find((c) => c.provider === 'OURA') ?? null);
      setAppleConnection(connections.find((c) => c.provider === 'APPLE_HEALTH') ?? null);
      setHcConnection(connections.find((c) => c.provider === 'HEALTH_CONNECT') ?? null);
    } catch {
      setLoadError(true);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // The Oura consent screen runs in a separate browser (in-app sheet or a new
  // tab) that ends on a result page of the server — it cannot tell this screen
  // anything. So when the person comes back to the app, re-read the status.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(true);
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'ios') {
      setAppleSupported(false);
      return;
    }
    appleHealthNative.isSupported().then((supported) => {
      if (!cancelled) setAppleSupported(supported);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshHealthConnect = useCallback(async () => {
    const availability = await healthConnectNative.availability();
    setHcAvailability(availability);
    if (availability === 'available') {
      setHcBackground((await healthConnectNative.getAccess()).background);
    }
  }, []);

  useEffect(() => {
    refreshHealthConnect();
    // Returning from the Health Connect screens (permissions, settings) changes what is granted.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshHealthConnect();
    });
    return () => subscription.remove();
  }, [refreshHealthConnect]);

  async function handleHealthConnectSync() {
    setHcSyncing(true);
    setHcMessage(null);
    try {
      const outcome = await syncHealthConnect(hcConnection?.lastSyncAt, { interactive: true });
      if (outcome.status === 'synced') {
        setHcMessage({ ok: true, text: t('health.hc.synced', { count: outcome.days }) });
      } else if (outcome.status === 'no_data') {
        setHcMessage({ ok: false, text: t('health.hc.noData') });
      } else if (outcome.status === 'no_permission') {
        setHcMessage({ ok: false, text: t('health.hc.noPermission') });
      } else {
        setHcMessage({ ok: false, text: t('health.hc.unavailable') });
      }
      if (outcome.status === 'synced' || outcome.status === 'no_data') {
        // Background reads only work when the person granted them in Health Connect.
        const access = await healthConnectNative.getAccess();
        setHcBackground(access.background);
        if (access.background) await registerHealthConnectBackgroundSync();
      }
      await load(true);
    } catch (error) {
      setHcMessage({
        ok: false,
        text: error instanceof HealthConnectRateLimitedError ? error.message : t('health.hc.syncFailed'),
      });
    } finally {
      setHcSyncing(false);
    }
  }

  async function handleAppleSync() {
    setAppleSyncing(true);
    setAppleMessage(null);
    try {
      const outcome = await syncAppleHealth(appleConnection?.lastSyncAt);
      if (outcome.status === 'synced') {
        setAppleMessage({ ok: true, text: t('health.apple.synced', { count: outcome.days }) });
      } else if (outcome.status === 'no_data') {
        setAppleMessage({
          ok: false,
          text: t('health.apple.noData'),
        });
      } else {
        setAppleMessage({ ok: false, text: t('health.apple.unavailable') });
      }
      await load(true);
    } catch (error) {
      setAppleMessage({
        ok: false,
        text:
          error instanceof AppleHealthRateLimitedError
            ? error.message
            : t('health.apple.syncFailed'),
      });
    } finally {
      setAppleSyncing(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setConnectError(false);
    try {
      const { authorizationUrl } = await getOuraAuthorizationUrl();
      await WebBrowser.openBrowserAsync(authorizationUrl);
      // The user authorizes (or declines) in that browser, which ends on a
      // result page of our server, not back in this app — there's no result
      // to await here. Refresh now (native: the sheet was just closed) and
      // again whenever the app becomes active (web: the tab is left open).
      await load(true);
    } catch {
      setConnectError(true);
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncOura();
      setSyncStatus(result);
      if (result === 'queued') {
        setTimeout(() => load(true), 5000);
      }
    } catch {
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setDisconnectError(false);
    try {
      await disconnectOura();
      await load(true);
    } catch {
      setDisconnectError(true);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const status = connection?.status ?? 'DISCONNECTED';
  const isConnected = status === 'CONNECTED';
  const canReconnect = status === 'AUTH_REQUIRED' || status === 'ERROR';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {loadError ? <Alert variant="destructive">{t('devices.loadFailed')}</Alert> : null}

      <Card style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Oura Ring</Text>
          <StatusBadge status={status} />
        </View>
        <Text style={styles.cardDescription}>
          {isConnected
            ? t('devices.oura.connected')
            : canReconnect
              ? t('devices.oura.needsAttention')
              : t('devices.oura.connectPrompt')}
        </Text>

        {connection?.lastSyncAt ? (
          <Text style={styles.metaText}>
            {connection.lastSyncStatus
              ? t('devices.oura.lastSyncAttemptWithStatus', {
                  date: new Date(connection.lastSyncAt).toLocaleString(locale()),
                  status: connection.lastSyncStatus,
                })
              : t('devices.oura.lastSyncAttempt', { date: new Date(connection.lastSyncAt).toLocaleString(locale()) })}
          </Text>
        ) : null}

        {connectError ? <Alert variant="destructive">{t('devices.oura.connectFailed')}</Alert> : null}
        {disconnectError ? <Alert variant="destructive">{t('devices.oura.disconnectFailed')}</Alert> : null}
        {syncStatus ? (
          <Alert variant={syncStatus === 'queued' ? 'success' : 'destructive'}>{t(SYNC_MESSAGE_KEY[syncStatus])}</Alert>
        ) : null}

        <View style={styles.row}>
          {isConnected ? (
            <>
              <Button
                title={syncing ? t('devices.syncing') : t('devices.syncNow')}
                variant="outline"
                size="sm"
                onPress={handleSync}
                loading={syncing}
                style={styles.flex1}
              />
              <Button
                title={disconnecting ? t('devices.oura.disconnecting') : t('devices.oura.disconnect')}
                variant="destructive"
                size="sm"
                onPress={handleDisconnect}
                loading={disconnecting}
                style={styles.flex1}
              />
            </>
          ) : (
            <Button
              title={connecting ? t('devices.oura.opening') : canReconnect ? t('devices.oura.reconnect') : t('devices.oura.connect')}
              size="sm"
              onPress={handleConnect}
              loading={connecting}
              style={styles.flex1}
            />
          )}
        </View>

        {isConnected ? (
          <Text style={styles.hintText}>{t('devices.oura.dailySyncHint')}</Text>
        ) : null}
      </Card>

      <Card style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Apple Health</Text>
          {appleSupported === false ? (
            <View style={[styles.badge, { backgroundColor: colors.muted.default }]}>
              <Text style={[styles.badgeText, { color: colors.muted.foreground }]}>{t('devices.apple.iphoneOnly')}</Text>
            </View>
          ) : (
            <StatusBadge status={appleConnection?.status ?? 'DISCONNECTED'} />
          )}
        </View>

        {appleSupported === false ? (
          <Text style={styles.cardDescription}>{t('devices.apple.notOnThisDevice')}</Text>
        ) : (
          <>
            <Text style={styles.cardDescription}>
              {appleConnection?.status === 'CONNECTED'
                ? t('devices.apple.connectedDescription')
                : t('devices.apple.connectDescription')}
            </Text>
            {appleConnection?.lastSyncAt ? (
              <Text style={styles.metaText}>
                {t('devices.apple.lastSync', { date: new Date(appleConnection.lastSyncAt).toLocaleString(locale()) })}
              </Text>
            ) : null}
            {appleMessage ? (
              <Alert variant={appleMessage.ok ? 'success' : 'destructive'}>{appleMessage.text}</Alert>
            ) : null}
            <Button
              title={
                appleSyncing
                  ? t('devices.syncing')
                  : appleConnection?.status === 'CONNECTED'
                    ? t('devices.syncNow')
                    : t('devices.apple.connect')
              }
              variant={appleConnection?.status === 'CONNECTED' ? 'outline' : 'primary'}
              size="sm"
              onPress={handleAppleSync}
              loading={appleSyncing}
              disabled={appleSupported !== true}
            />
            {appleConnection?.status === 'CONNECTED' ? (
              <Text style={styles.hintText}>{t('devices.apple.stopHint')}</Text>
            ) : null}
          </>
        )}
      </Card>

      <Card style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Health Connect</Text>
          {hcAvailability === 'unsupported' && hcConnection?.status !== 'CONNECTED' ? (
            <View style={[styles.badge, { backgroundColor: colors.muted.default }]}>
              <Text style={[styles.badgeText, { color: colors.muted.foreground }]}>{t('devices.hc.androidOnly')}</Text>
            </View>
          ) : (
            <StatusBadge status={hcConnection?.status ?? 'DISCONNECTED'} />
          )}
        </View>

        {hcAvailability === 'unsupported' ? (
          // Web / iPhone: only shows what the Android app has set up.
          hcConnection?.status === 'CONNECTED' ? (
            <>
              <Text style={styles.cardDescription}>{t('devices.hc.connectedElsewhere')}</Text>
              {hcConnection.connectedAt ? (
                <Text style={styles.metaText}>
                  {t('devices.hc.connectedAt', { date: new Date(hcConnection.connectedAt).toLocaleString(locale()) })}
                </Text>
              ) : null}
              <Text style={styles.metaText}>
                {hcConnection.lastSyncAt
                  ? t('devices.hc.lastSync', { date: new Date(hcConnection.lastSyncAt).toLocaleString(locale()) })
                  : t('devices.hc.neverSynced')}
              </Text>
            </>
          ) : (
            <Text style={styles.cardDescription}>{t('devices.hc.notOnThisDevice')}</Text>
          )
        ) : (
          <>
            <Text style={styles.cardDescription}>
              {hcConnection?.status === 'CONNECTED' ? t('devices.hc.connectedDescription') : t('devices.hc.connectDescription')}
            </Text>
            {hcAvailability === 'unavailable' ? <Alert variant="destructive">{t('devices.hc.unavailable')}</Alert> : null}
            {hcAvailability === 'update_required' ? (
              <Alert variant="destructive">{t('devices.hc.updateRequired')}</Alert>
            ) : null}
            {hcConnection?.status === 'CONNECTED' ? (
              <>
                {hcConnection.connectedAt ? (
                  <Text style={styles.metaText}>
                    {t('devices.hc.connectedAt', { date: new Date(hcConnection.connectedAt).toLocaleString(locale()) })}
                  </Text>
                ) : null}
                <Text style={styles.metaText}>
                  {hcConnection.lastSyncAt
                    ? t('devices.hc.lastSync', { date: new Date(hcConnection.lastSyncAt).toLocaleString(locale()) })
                    : t('devices.hc.neverSynced')}
                </Text>
              </>
            ) : null}
            {hcMessage ? <Alert variant={hcMessage.ok ? 'success' : 'destructive'}>{hcMessage.text}</Alert> : null}
            <Button
              title={
                hcSyncing
                  ? t('devices.syncing')
                  : hcConnection?.status === 'CONNECTED'
                    ? t('devices.syncNow')
                    : t('devices.hc.connect')
              }
              variant={hcConnection?.status === 'CONNECTED' ? 'outline' : 'primary'}
              size="sm"
              onPress={handleHealthConnectSync}
              loading={hcSyncing}
              disabled={hcAvailability !== 'available'}
            />
            {hcAvailability === 'available' ? (
              <Button
                title={t('devices.hc.manage')}
                variant="outline"
                size="sm"
                onPress={() => healthConnectNative.openSettings()}
              />
            ) : null}
            {hcConnection?.status === 'CONNECTED' ? (
              <>
                <Text style={styles.hintText}>
                  {hcBackground ? t('devices.hc.backgroundOn') : t('devices.hc.backgroundOff')}
                </Text>
                <Text style={styles.hintText}>{t('devices.hc.stopHint')}</Text>
              </>
            ) : null}
          </>
        )}
      </Card>

      <Text style={styles.disclaimer}>{t('devices.disclaimer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBackground,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.foreground,
  },
  cardGap: {
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  cardDescription: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  metaText: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  hintText: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  badge: {
    borderRadius: radii.xl,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  disclaimer: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
});
